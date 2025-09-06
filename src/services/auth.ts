// worker/handlers/auth.ts
// Minimal auth handler: hardcoded single user, secure cookie session.
// Endpoints:
//   POST /api/auth/login    -> body: { username, password }
//   GET  /api/auth/me       -> returns { ok: true, user: { name } } if logged in
//   POST /api/auth/logout   -> clears session cookie

export interface Env {
  SESSION_SECRET?: string;
}

type Ctx = {
  req: Request;
  env: Env;
};

const COOKIE_NAME = "cb_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function b64url(uint8: Uint8Array) {
  // @ts-ignore: atob not needed
  let str = "";
  for (const b of uint8) str += String.fromCharCode(b);
  // @ts-ignore
  const base64 = btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return base64;
}

async function hmacSHA256(key: string, msg: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return b64url(new Uint8Array(sig));
}

async function makeSession(env: Env) {
  const rnd = new Uint8Array(16);
  crypto.getRandomValues(rnd);
  const id = b64url(rnd);
  const issued = Date.now();
  const payload = `id=${id}&iat=${issued}`;
  const secret = env.SESSION_SECRET || "dev-secret";
  const sig = await hmacSHA256(secret, payload);
  return `s:${payload}.${sig}`;
}

async function verifySession(env: Env, cookieVal?: string | null) {
  if (!cookieVal) return false;
  if (!cookieVal.startsWith("s:")) return false;
  const secret = env.SESSION_SECRET || "dev-secret";
  const body = cookieVal.slice(2);
  const dot = body.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const expected = await hmacSHA256(secret, payload);
  return sig === expected;
}

function getCookie(req: Request, name: string) {
  const raw = req.headers.get("Cookie") || "";
  const parts = raw.split(/;\s*/);
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function setCookieHeader(name: string, value: string, maxAgeSec: number) {
  const attrs = [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Secure`,
    `Max-Age=${maxAgeSec}`,
  ].join("; ");
  return `${name}=${value}; ${attrs}`;
}

function clearCookieHeader(name: string) {
  const attrs = [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Secure`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `Max-Age=0`,
  ].join("; ");
  return `${name}=; ${attrs}`;
}

// --- Handlers ---

export async function login({ req, env }: Ctx): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const { username, password } = body;

  // Single allowed user (not shown anywhere client-side)
  const ok = username === "chris" && password === "badcommand";
  if (!ok) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await makeSession(env);
  return new Response(JSON.stringify({ ok: true, user: { name: "chris" } }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": setCookieHeader(COOKIE_NAME, encodeURIComponent(session), COOKIE_MAX_AGE),
      "Cache-Control": "no-store",
    },
  });
}

export async function me({ req, env }: Ctx): Promise<Response> {
  const cookieVal = getCookie(req, COOKIE_NAME);
  const valid = await verifySession(env, cookieVal);
  if (!valid) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  return new Response(JSON.stringify({ ok: true, user: { name: "chris" } }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function logout({ req }: Ctx): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookieHeader(COOKIE_NAME),
      "Cache-Control": "no-store",
    },
  });
}
