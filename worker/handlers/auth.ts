// worker/handlers/auth.ts
// Minimal, robust auth for single user: chris / badcommand
// Endpoints:
//   POST /api/auth/login    -> body: { username, password }
//   GET  /api/auth/me       -> returns { ok: true, user: { name: "chris" } } if logged in
//   POST /api/auth/logout   -> clears session cookie

try { console.log("🐛 [auth] module loaded"); } catch {}

type Ctx = {
  req: Request;
  env: any; // keep loose to avoid type coupling
};

const COOKIE_NAME = "cb_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days



// Figure out a safe cookie Domain so apex + www share the session in prod.
// For local/dev/preview hosts, we omit Domain so the cookie stays host-scoped (works in dev).
function cookieDomainFor(req: Request): string | null {
  const host = new URL(req.url).hostname.toLowerCase();

  // Production domains you actually use
  if (host === "chrisbrighouse.com" || host === "www.chrisbrighouse.com") {
    return ".chrisbrighouse.com";
  }
  // If you later add subdomains like app.chrisbrighouse.com, this still works:
  if (host.endsWith(".chrisbrighouse.com")) {
    return ".chrisbrighouse.com";
  }

  // Workers dev/preview, localhost, etc. → keep host-only to avoid cross-site cookie issues.
  return null;
}

function setCookieHeader(name: string, value: string, maxAgeSec: number, domain: string | null) {
  const attrs = [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Secure`,
    `Max-Age=${maxAgeSec}`,
  ];
  if (domain) attrs.push(`Domain=${domain}`);
  return `${name}=${value}; ${attrs.join("; ")}`;
}

function clearCookieHeader(name: string, domain: string | null) {
  const attrs = [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Secure`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `Max-Age=0`,
  ];
  if (domain) attrs.push(`Domain=${domain}`);
  return `${name}=; ${attrs.join("; ")}`;
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

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });
}

// --- Handlers ---

export async function login({ req }: Ctx): Promise<Response> {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, { status: 405 });

    let body: { username?: string; password?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "Bad Request" }, { status: 400 });
    }
    const { username, password } = body;

    // Single allowed user (not shown client-side)
    if (!(username === "chris" && password === "badcommand")) {
      return json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    // Simple, robust session value (no HMAC to avoid subtle crypto issues)
    const session = `s:${crypto.randomUUID()}.${Date.now()}`;

    const domain = cookieDomainFor(req);
    return json(
      { ok: true, user: { name: "chris" } },
      {
        status: 200,
        headers: {
          "Set-Cookie": setCookieHeader(COOKIE_NAME, encodeURIComponent(session), COOKIE_MAX_AGE, domain),
        },
      }
    );
  } catch {
    return json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function me({ req }: Ctx): Promise<Response> {
  try {
    const cookieVal = getCookie(req, COOKIE_NAME);
    if (!cookieVal || !decodeURIComponent(cookieVal).startsWith("s:")) {
      return json({ ok: false }, { status: 401 });
    }
    return json({ ok: true, user: { name: "chris" } }, { status: 200 });
  } catch {
    return json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function logout({ req }: Ctx): Promise<Response> {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
    const domain = cookieDomainFor(req);
    return json(
      { ok: true },
      {
        status: 200,
        headers: {
          "Set-Cookie": clearCookieHeader(COOKIE_NAME, domain),
        },
      }
    );
  } catch {
    return json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
