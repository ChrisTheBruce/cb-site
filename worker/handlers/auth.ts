// worker/handlers/auth.ts
import type { Env } from "../env";

/** Parse body as JSON or x-www-form-urlencoded; return a plain object */
async function readBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      return (j && typeof j === "object") ? j as any : {};
    }
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      const obj: Record<string, string> = {};
      params.forEach((v, k) => (obj[k] = v));
      return obj;
    }
  } catch { /* ignore */ }
  return {};
}

function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("Cookie") || "";
  const parts = cookie.split(/;\s*/);
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(p.slice(idx + 1));
  }
  return null;
}

function setCookie(name: string, value: string, opts: {
  domain?: string; path?: string; maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: "Lax"|"Strict"|"None";
}) {
  const bits = [`${name}=${encodeURIComponent(value)}`];
  if (opts.domain) bits.push(`Domain=${opts.domain}`);
  bits.push(`Path=${opts.path ?? "/"}`);
  if (typeof opts.maxAge === "number") bits.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly !== false) bits.push("HttpOnly");
  if (opts.secure !== false) bits.push("Secure");
  bits.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return bits.join("; ");
}

const AUTH_COOKIE = "cb_auth";

/**
 * GET /api/auth/me
 * Reads the auth cookie. 401 if missing.
 */
export async function me(req: Request, _env: Env): Promise<Response> {
  const user = getCookie(req, AUTH_COOKIE);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  return new Response(JSON.stringify({ username: user }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/auth/login
 * Accepts JSON { username, password } OR { user, pass } OR form data.
 * If valid (chris / badcommand), sets cookie for .chrisbrighouse.com.
 */
export async function login(req: Request, _env: Env): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const body = await readBody(req);
  const username = (body.username ?? body.user ?? "").toString();
  const password = (body.password ?? body.pass ?? "").toString();

  // super simple demo auth as per your requirement
  const ok = username === "chris" && password === "badcommand";
  if (!ok) {
    return new Response("Unauthorized", { status: 401 });
  }

  // IMPORTANT: set cookie for parent domain so it works on apex and www
  const set = setCookie(AUTH_COOKIE, username, {
    domain: ".chrisbrighouse.com",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });

  return new Response(JSON.stringify({ ok: true, user: { username } }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": set,
    },
  });
}

/**
 * POST /api/auth/logout
 * Clears the cookie (Max-Age=0) for the same Domain/Path.
 */
export async function logout(_req: Request, _env: Env): Promise<Response> {
  const del = `${AUTH_COOKIE}=; Domain=.chrisbrighouse.com; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": del,
    },
  });
}
