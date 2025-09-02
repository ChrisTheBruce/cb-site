// worker/handlers/auth.ts
// Minimal username/password auth for the SPA.
// Exports: login (POST), logout (POST), me (GET)

type Env = {
  // Optional overrides via wrangler vars/secrets if you want later
  AUTH_USER?: string;
  AUTH_PASS?: string;
};

const DEFAULT_USER = "chris";
const DEFAULT_PASS = "badcommand";

const COOKIE_NAME = "cb_auth";      // session cookie name
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function makeCookie(value: string, maxAge?: number) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure", // you’re on HTTPS on Cloudflare
  ];
  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}

function json(status: number, data: unknown, extraHeaders?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(extraHeaders || {}),
    },
  });
}

export async function login(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const username = String(body?.username || "");
  const password = String(body?.password || "");

  const expectedUser = env.AUTH_USER || DEFAULT_USER;
  const expectedPass = env.AUTH_PASS || DEFAULT_PASS;

  if (username !== expectedUser || password !== expectedPass) {
    // Clear any stray cookie on bad login (defensive)
    return json(401, { ok: false, error: "Invalid credentials" }, {
      "Set-Cookie": makeCookie("", 0),
    });
  }

  // Minimal session; value can be anything truthy. No PII in the cookie.
  const headers = new Headers();
  headers.set("Set-Cookie", makeCookie("1", COOKIE_TTL_SECONDS));

  // Return a simple shape most UIs can consume
  return json(200, { ok: true, user: { username } }, headers);
}

export async function logout(_req: Request, _env: Env): Promise<Response> {
  // Expire the cookie
  return json(200, { ok: true }, { "Set-Cookie": makeCookie("", 0) });
}

export async function me(req: Request, env: Env): Promise<Response> {
  // Check cookie presence
  const cookies = parseCookies(req);
  const isAuth = cookies[COOKIE_NAME] === "1";

  if (!isAuth) {
    // Not logged in
    return json(401, { ok: false, user: null });
  }

  const expectedUser = env.AUTH_USER || DEFAULT_USER;
  return json(200, { ok: true, user: { username: expectedUser } });
}
