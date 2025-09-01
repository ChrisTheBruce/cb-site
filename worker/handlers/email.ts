// worker/handlers/email.ts
// Handles: POST /api/email   -> set dl_email cookie
//          POST /api/email/clear -> clear dl_email cookie

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOKIE_NAME = "dl_email";

// Minimal JSON helper (keeps this file self-contained)
function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

// Build a cookie string that is readable by the browser (NOT HttpOnly)
// so the frontend badge can display it. Secure is fine (site is HTTPS).
function buildEmailCookie(value: string, maxAgeSeconds: number) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join("; ");
}

export async function setEmailHandler(request: Request): Promise<Response> {
  // Expect: { email: string }
  let email: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.email === "string") {
      email = body.email.trim();
    }
  } catch {
    // fall through to invalid
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  const oneYear = 60 * 60 * 24 * 365;
  const cookie = buildEmailCookie(email, oneYear);

  return json({ ok: true, email }, { headers: { "Set-Cookie": cookie } });
}

export async function clearEmailHandler(_request: Request): Promise<Response> {
  const cookie = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "SameSite=Lax",
    "Secure",
    "Max-Age=0",
  ].join("; ");

  return json({ ok: true }, { headers: { "Set-Cookie": cookie } });
}

/**
 * (Optional) Tiny convenience router if you call this file directly from the Worker:
 * 
 *  import { emailRoutes } from "./handlers/email";
 *  // inside your fetch handler:
 *  const res = await emailRoutes(request);
 *  if (res) return res;
 */
export async function emailRoutes(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname === "/api/email") {
    return setEmailHandler(request);
  }
  if (request.method === "POST" && url.pathname === "/api/email/clear") {
    return clearEmailHandler(request);
  }
  return null;
}
