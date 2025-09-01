import type { Env } from "../env";
import { json, bad } from "../lib/responses";
import { isAllowedMethod, requireOrigin } from "../lib/security";
import { parseCookies, serializeCookie } from "../lib/cookies";

const AUTH_COOKIE = "auth_session";

async function hmacSHA256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  let b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
const b64 = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const unb64 = (s: string) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return atob(s); };

async function createSession(env: Env, username: string) {
  const issued = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ u: username, iat: issued });
  const payloadB64 = b64(payload);
  const sig = await hmacSHA256(env.AUTH_SECRET, payloadB64);
  return `${payloadB64}.${sig}`;
}

async function verifySession(env: Env, token: string): Promise<{ ok: boolean; user?: string }> {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false };
  const [payloadB64, sig] = parts;
  const expected = await hmacSHA256(env.AUTH_SECRET, payloadB64);
  if (sig !== expected) return { ok: false };
  try {
    const obj = JSON.parse(unb64(payloadB64));
    if (!obj?.u) return { ok: false };
    return { ok: true, user: obj.u };
  } catch {
    return { ok: false };
  }
}

export async function handleLogin(request: Request, env: Env, rid: string) {
  if (!isAllowedMethod(request, ["POST"])) return bad(405, "Method not allowed", rid);
  if (!requireOrigin(request)) return bad(403, "Forbidden (origin)", rid);

  const { username, password } = await request.json().catch(() => ({} as any));
  if (username === "chris" && password === "badcommand") {
    const token = await createSession(env, username);
    const cookie = serializeCookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });
    return new Response(JSON.stringify({ ok: true, user: { name: "chris" } }), {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": cookie },
    });
  }
  return bad(401, "Invalid credentials", rid);
}

export async function handleMe(request: Request, env: Env, rid: string) {
  const cookies = parseCookies(request);
  const token = cookies[AUTH_COOKIE];
  if (!token) return bad(401, "Not authenticated", rid);
  const { ok, user } = await verifySession(env, token);
  if (!ok) return bad(401, "Invalid session", rid);
  return json({ ok: true, user: { name: user } });
}

export async function handleLogout(_request: Request, _env: Env, _rid: string) {
  const cookie = serializeCookie(AUTH_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": cookie },
  });
}
