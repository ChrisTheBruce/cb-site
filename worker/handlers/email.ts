// worker/handlers/email.ts
// Endpoints handled here:
//   POST /api/email         -> set dl_email cookie (readable by client for UI badge)
//   POST /api/email/clear   -> clear dl_email cookie (and legacy names)
//
// This file is self-contained (no external imports) so you can drop it in directly.

export type Env = {
  // Optional override for the cookie name
  DL_EMAIL_COOKIE_NAME?: string;
};

const DEFAULT_COOKIE_NAME = "dl_email";
const LEGACY_NAMES = ["DL_EMAIL", "cb_dl_email"];

/** Simple email sanity check (good enough for UI capture) */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** JSON helper that always sets a JSON content type */
function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

/** Try to parse JSON body; fall back to empty object */
async function readJSON(req: Request): Promise<any> {
  try {
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      return await req.json();
    }
  } catch { /* ignore */ }
  return {};
}

/** Return true if we should mark cookies as Secure */
function isSecureRequest(req: Request): boolean {
  try {
    const url = new URL(req.url);
    if (url.protocol === "https:") return true;
  } catch { /* ignore */ }
  // honor common proxy header if present
  const xfp = req.headers.get("x-forwarded-proto") || "";
  return xfp.toLowerCase().includes("https");
}

/**
 * Build 1..N Set-Cookie header values for a single cookie name/value with reasonable defaults.
 * We emit multiple variants:
 *  - without Domain (current host only)
 *  - and, if appropriate, with Domain set to a broader host (e.g., chrisbrighouse.com)
 * This improves chances of clearing/reading regardless of how it was originally set.
 */
function buildCookieHeaders(
  name: string,
  value: string,
  opts: {
    req: Request;
    // expire immediately if true; otherwise a long-lived cookie
    expire?: boolean;
    maxAgeSeconds?: number;
    httpOnly?: boolean; // default false so client can read for UI
    sameSite?: "Lax" | "Strict" | "None";
    path?: string;
  }
): string[] {
  const headers: string[] = [];
  const url = new URL(opts.req.url);
  const hostname = url.hostname;
  const secure = isSecureRequest(opts.req);

  // base attributes
  const attrs: string[] = [];
  attrs.push(`Path=${opts.path || "/"}`);
  const same = opts.sameSite || "Lax";
  attrs.push(`SameSite=${same}`);
  if (secure || same === "None") attrs.push("Secure");
  if (opts.httpOnly) attrs.push("HttpOnly");

  if (opts.expire) {
    attrs.push("Max-Age=0");
    attrs.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  } else if (opts.maxAgeSeconds != null) {
    attrs.push(`Max-Age=${opts.maxAgeSeconds}`);
  } else {
    // ~180 days default
    attrs.push(`Max-Age=${60 * 60 * 24 * 180}`);
  }

  // Helper to construct one cookie string
  const make = (domain?: string) =>
    `${name}=${encodeURIComponent(value)}${domain ? `; Domain=${domain}` : ""}; ${attrs.join("; ")}`;

  // 1) without Domain (scoped to current host)
  headers.push(make());

  // 2) with a broader Domain if it seems safe
  const candidates = possibleCookieDomains(hostname);
  for (const d of candidates) headers.push(make(d));

  return headers;
}

/** Produce candidate "Domain=" values to try */
function possibleCookieDomains(hostname: string): string[] {
  // don’t attempt Domain on localhost or IPs
  if (hostname === "localhost" || /^[0-9.]+$/.test(hostname)) return [];

  // If host starts with "www.", try the apex without it.
  if (hostname.startsWith("www.")) {
    const apex = hostname.slice(4);
    // Avoid workers.dev (setting Domain=*.workers.dev is not allowed)
    if (!apex.endsWith(".workers.dev")) return [apex];
    return [];
  }

  // If host looks like foo.bar.baz, try bar.baz
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const maybeApex = parts.slice(-2).join(".");
    if (!maybeApex.endsWith(".workers.dev")) return [maybeApex];
  }

  // Default: no domain variant
  return [];
}

/** Set email cookie */
export async function setEmailHandler(req: Request, env?: Env): Promise<Response> {
  const name = (env && env.DL_EMAIL_COOKIE_NAME) || DEFAULT_COOKIE_NAME;
  const body = await readJSON(req);
  const email = (body?.email || "").toString().trim();

  if (!email || !EMAIL_REGEX.test(email)) {
    return json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const headers = new Headers();
  for (const h of buildCookieHeaders(name, email, { req, httpOnly: false, sameSite: "Lax" })) {
    headers.append("Set-Cookie", h);
  }

  return json({ ok: true, email }, { status: 200, headers });
}

/** Clear email cookie(s) */
export async function clearEmailHandler(req: Request, env?: Env): Promise<Response> {
  const name = (env && env.DL_EMAIL_COOKIE_NAME) || DEFAULT_COOKIE_NAME;
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });

  // Clear primary + legacy names
  for (const n of [name, ...LEGACY_NAMES]) {
    for (const h of buildCookieHeaders(n, "", { req, expire: true })) {
      headers.append("Set-Cookie", h);
    }
  }

  // Always return 200 so the client UX is not blocked by strict error handling
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

/**
 * Convenience router: call this early in your Worker `fetch`/router.
 * Returns a Response if the path matches, otherwise null to continue.
 *
 * Example:
 *   const res = await emailRoutes(request, env);
 *   if (res) return res;
 */
export async function emailRoutes(request: Request, env?: Env): Promise<Response | null> {
  try {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/email") {
      return setEmailHandler(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/email/clear") {
      return clearEmailHandler(request, env);
    }
    return null;
  } catch (err) {
    // If URL parsing ever fails, be defensive and return null to let other routes handle.
    return null;
  }
}
