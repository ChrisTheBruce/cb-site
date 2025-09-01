// worker/handlers/auth.ts
// Simple demo auth: POST /api/login, GET /api/me, POST /api/logout
// NOTE: This is intentionally minimal and not production-grade.
// It uses a fixed credential and an opaque session cookie.

const EMAIL_JSON = "application/json; charset=utf-8";
const AUTH_COOKIE = "cb_auth";
const VALID_USER = "chris";
const VALID_PASS = "badcommand";

// --- tiny helpers ---
function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", EMAIL_JSON);
  return new Response(JSON.stringify(data), { ...init, headers });
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    "Secure",
    "HttpOnly",
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

function clearCookie(name: string) {
  return [`${name}=`, "Path=/", "SameSite=Lax", "Secure", "HttpOnly", "Max-Age=0"].join("; ");
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// --- handlers ---
export async function loginHandler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body?.username ?? "").toString().trim();
  const password = (body?.password ?? "").toString();

  if (username !== VALID_USER || password !== VALID_PASS) {
    return json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  // Minimal opaque "session". For real usage, mint a signed token.
  const value = JSON.stringify({ u: username, t: Date.now() });
  const cookie = setCookie(AUTH_COOKIE, value, 60 * 60 * 8); // 8 hours

  return json({ ok: true, user: { username } }, { headers: { "Set-Cookie": cookie } });
}

export async function logoutHandler(_request: Request): Promise<Response> {
  const cookie = clearCookie(AUTH_COOKIE);
  return json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}

export async function meHandler(request: Request): Promise<Response> {
  const sess = readCookie(request, AUTH_COOKIE);
  if (!sess) return json({ ok: false, error: "Not authenticated" }, { status: 401 });

  // Best effort parse
  let user = "unknown";
  try {
    const obj = JSON.parse(sess);
    if (obj?.u) user = String(obj.u);
  } catch {
    // fall through
  }
  return json({ ok: true, user: { username: user } });
}
