// /worker/handlers/email.ts
import { corsHeaders } from '../router';

export async function clearCookie(): Promise<Response> {
  const expires = new Date(0).toUTCString();
  const setCookie = [
    'download_email=',
    'Path=/',
    `Expires=${expires}`,
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    // Keep Domain= if you need cross-apex (e.g., apex + www). Remove if unsure.
    'Domain=chrisbrighouse.com',
  ].join('; ');

  console.log('[🐛 DBG][WK] matched /api/email/clear → clearing cookie');

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, 'Set-Cookie': setCookie },
  });
}


/*
// worker/handlers/email.ts
// Handles:
//   POST /api/email         -> set dl_email cookie
//   POST /api/email/clear   -> clear dl_email cookie (and legacy names)

export type Env = {
  DL_EMAIL_COOKIE_NAME?: string; // optional override
};

const DEFAULT_COOKIE_NAME = "dl_email";
const LEGACY_NAMES = ["DL_EMAIL", "cb_dl_email"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toBool(x: any): boolean {
  const s = String(x ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function isSecure(req: Request): boolean {
  try {
    const url = new URL(req.url);
    if (url.protocol === "https:") return true;
  } catch {}
  const xfp = req.headers.get("x-forwarded-proto") || "";
  return xfp.toLowerCase().includes("https");
}

function apexFromHost(hostname: string): string | null {
  if (!hostname || hostname === "localhost" || /^[0-9.]+$/.test(hostname)) return null;
  if (hostname.endsWith(".workers.dev")) return null;
  if (hostname.startsWith("www.")) return hostname.slice(4);
  const parts = hostname.split(".");
  if (parts.length >= 3) return parts.slice(-2).join(".");
  return null;
}

type CookieOpts = {
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
  maxAge?: number; // seconds
  expireNow?: boolean;
};

function buildCookie(name: string, value: string, opts: CookieOpts = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  parts.push(`Path=${opts.path || "/"}`);
  const same = opts.sameSite || "Lax";
  parts.push(`SameSite=${same}`);
  if (opts.secure || same === "None") parts.push("Secure");
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.expireNow) {
    parts.push("Max-Age=0");
    parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  } else if (typeof opts.maxAge === "number") {
    parts.push(`Max-Age=${opts.maxAge}`);
  } else {
    parts.push(`Max-Age=${60 * 60 * 24 * 180}`); // ~180 days default
  }
  return parts.join("; ");
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function readJSON(req: Request): Promise<any> {
  try {
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      return await req.json();
    }
  } catch {}
  return {};
}

/* ---------- SET EMAIL ---------- */
export async function setEmailHandler(req: Request, env?: Env): Promise<Response> {
  try {
    const name = (env && env.DL_EMAIL_COOKIE_NAME) || DEFAULT_COOKIE_NAME;
    const body = await readJSON(req);
    const email = String(body?.email ?? "").trim();
    if (!email || !EMAIL_REGEX.test(email)) {
      return json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const headers = new Headers();
    const host = new URL(req.url).hostname;
    const apex = apexFromHost(host);
    const secure = isSecure(req);

    // Host-scoped
    headers.append(
      "Set-Cookie",
      buildCookie(name, email, { secure, httpOnly: false, sameSite: "Lax" })
    );
    // Apex-scoped (if applicable)
    if (apex) {
      headers.append(
        "Set-Cookie",
        buildCookie(name, email, {
          secure,
          httpOnly: false,
          sameSite: "Lax",
          domain: apex,
        })
      );
    }

    return json({ ok: true, email }, { status: 200, headers });
  } catch (err: any) {
    console.log("email.set failed", err?.message || err);
    return json({ ok: false, error: "email_set_failed" }, { status: 200 });
  }
}

/* ---------- CLEAR EMAIL ---------- */
export async function clearEmailHandler(req: Request, env?: Env): Promise<Response> {
  try {
    const name = (env && env.DL_EMAIL_COOKIE_NAME) || DEFAULT_COOKIE_NAME;
    const headers = new Headers({ "content-type": "application/json; charset=utf-8" });

    const host = new URL(req.url).hostname;
    const apex = apexFromHost(host);
    const secure = isSecure(req);

    const names = [name, ...LEGACY_NAMES];

    for (const n of names) {
      // Host-scoped expiry
      headers.append(
        "Set-Cookie",
        buildCookie(n, "", { secure, sameSite: "Lax", expireNow: true })
      );
      // Apex-scoped expiry
      if (apex) {
        headers.append(
          "Set-Cookie",
          buildCookie(n, "", { secure, sameSite: "Lax", expireNow: true, domain: apex })
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (err: any) {
    // Never 500 the client: reply 200 + error so UX isn't blocked
    console.log("email.clear failed", err?.message || err);
    return json({ ok: false, error: "email_clear_failed" }, { status: 200 });
  }
}

/* ---------- ROUTER ---------- */
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
  } catch {
    return null;
  }
}
*/