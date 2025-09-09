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
  
  console.log("🍪 cookieDomainFor debug:", { url: req.url, host });

  // For localhost and development, always return null for host-scoped cookies
  if (host === "localhost" || host === "127.0.0.1" || host.includes("localhost")) {
    console.log("🍪 Detected localhost, returning null domain");
    return null;
  }

  const origin = req.headers.get("Origin") || "";
  const referer = req.headers.get("Referer") || "";
  
  if (origin.includes("localhost") || referer.includes("localhost")) {
    console.log("🔧 Development mode detected via headers - using null domain for localhost");
    return null;
  }

  const userAgent = req.headers.get("User-Agent") || "";
  const isLocalDev = userAgent.includes("Mozilla") && req.url.includes("chrisbrighouse.com");
  
  if (isLocalDev) {
    console.log("🍪 Detected CloudFlare Workers local dev, returning null domain");
    return null;
  }

  // Production domains you actually use
  if (host === "chrisbrighouse.com" || host === "www.chrisbrighouse.com") {
    console.log("🍪 Detected production domain, returning .chrisbrighouse.com");
    return ".chrisbrighouse.com";
  }
  // If you later add subdomains like app.chrisbrighouse.com, this still works:
  if (host.endsWith(".chrisbrighouse.com")) {
    console.log("🍪 Detected subdomain, returning .chrisbrighouse.com");
    return ".chrisbrighouse.com";
  }

  // Workers dev/preview, etc. → keep host-only to avoid cross-site cookie issues.
  console.log("🍪 Unknown host, returning null domain");
  return null;
}

function setCookieHeader(name: string, value: string, maxAgeSec: number, domain: string | null, req: Request) {
  const isSecure = new URL(req.url).protocol === "https:";
  const attrs = [
    `Path=/`,
    `HttpOnly`,
    `Max-Age=${maxAgeSec}`,
  ];
  
  if (isSecure) {
    attrs.push(`SameSite=None`);
    attrs.push(`Secure`);
  } else {
    attrs.push(`SameSite=Lax`);
  }
  
  if (domain) attrs.push(`Domain=${domain}`);
  return `${name}=${value}; ${attrs.join("; ")}`;
}

function clearCookieHeader(name: string, domain: string | null, req: Request) {
  const isSecure = new URL(req.url).protocol === "https:";
  const attrs = [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `Max-Age=0`,
  ];
  if (isSecure) attrs.push(`Secure`);
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

    console.log("🔐 Login attempt:", { username, hasPassword: !!password });

    // Single allowed user (not shown client-side)
    if (!(username === "chris" && password === "badcommand")) {
      console.log("❌ Invalid credentials");
      return json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    console.log("✅ Valid credentials - creating session");

    // Simple, robust session value (no HMAC to avoid subtle crypto issues)
    const session = `s:${crypto.randomUUID()}.${Date.now()}`;
    const domain = cookieDomainFor(req);
    const cookieHeader = setCookieHeader(COOKIE_NAME, encodeURIComponent(session), COOKIE_MAX_AGE, domain, req);
    
    console.log("✅ Login successful, setting cookie:", { domain, cookieHeader });
    return json(
      { ok: true, user: { id: "chris", email: "chris@chrisbrighouse.com", name: "chris" } },
      {
        status: 200,
        headers: {
          "Set-Cookie": cookieHeader,
        },
      }
    );
  } catch (err) {
    console.error("💥 Login error:", err);
    return json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function me({ req }: Ctx): Promise<Response> {
  try {
    const cookieVal = getCookie(req, COOKIE_NAME);
    if (!cookieVal || !decodeURIComponent(cookieVal).startsWith("s:")) {
      return json({ ok: false }, { status: 401 });
    }
    return json({ ok: true, user: { id: "chris", email: "chris@chrisbrighouse.com", name: "chris" } }, { status: 200 });
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
          "Set-Cookie": clearCookieHeader(COOKIE_NAME, domain, req),
        },
      }
    );
  } catch {
    return json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
