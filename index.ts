// index.ts — Cloudflare Worker (swap in completely)

export interface Env {
  ASSETS: Fetcher; // bound via wrangler "assets"
  AUTH_SECRET: string; // wrangler secret: wrangler secret put AUTH_SECRET
  FROM_ADDRESS?: string; // optional, default used if missing
  SUPPORT_EMAIL?: string; // optional, default used if missing
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    // Hand off to static assets / SPA handler
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // ---- Login
  if (path === "/api/login") {
    if (request.method !== "POST") return allowOnly(["POST"]);
    return login(request, env);
  }

  // ---- Logout
  if (path === "/api/logout") {
    if (request.method !== "POST") return allowOnly(["POST"]);
    return logout();
  }

  // ---- Who am I?
  if (path === "/api/me") {
    if (request.method !== "GET") return allowOnly(["GET"]);
    return me(request, env);
  }

  // ---- Notify download
  if (path === "/api/notify_download") {
    if (request.method !== "POST") return allowOnly(["POST"]);
    return notifyDownload(request, env);
  }

  return new Response("Not found", { status: 404 });
}

function allowOnly(methods: string[]) {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: methods.join(", ") } });
}

// ---------------------- AUTH HELPERS ----------------------

type SessionPayload = {
  sub: string;   // username
  iat: number;   // issued at (epoch secs)
  exp: number;   // expiry (epoch secs)
};

function b64urlFromArrayBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return base64;
}

async function hmacSHA256(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return b64urlFromArrayBuffer(sig);
}

async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = JSON.stringify(payload);
  const bodyB64 = btoa(body).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const sig = await hmacSHA256(secret, bodyB64);
  return `${bodyB64}.${sig}`;
}

async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  const [bodyB64, sig] = token.split(".");
  if (!bodyB64 || !sig) return null;
  const expected = await hmacSHA256(secret, bodyB64);
  if (expected !== sig) return null;
  let json: SessionPayload;
  try {
    const jsonStr = atob(bodyB64.replace(/-/g, "+").replace(/_/g, "/"));
    json = JSON.parse(jsonStr);
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (json.exp <= now) return null;
  return json;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("Cookie") || "";
  const out: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("="));
  });
  return out;
}

function setCookie(name: string, value: string, opts: { httpOnly?: boolean; maxAge?: number } = {}) {
  let c = `${name}=${value}; Path=/; SameSite=Lax; Secure`;
  if (opts.httpOnly) c += "; HttpOnly";
  if (opts.maxAge) c += `; Max-Age=${opts.maxAge}`;
  return c;
}

// ---------------------- ROUTES ----------------------

async function login(request: Request, env: Env): Promise<Response> {
  const ct = request.headers.get("content-type") || "";
  let username = "";
  let password = "";

  if (ct.includes("application/json")) {
    const b = await request.json().catch(() => ({}));
    username = (b.username || "").toString();
    password = (b.password || "").toString();
  } else if (ct.includes("application/x-www-form-urlencoded")) {
    const fd = await request.formData();
    username = String(fd.get("username") || "");
    password = String(fd.get("password") || "");
  } else {
    return new Response("Unsupported Media Type", { status: 415 });
  }

  // Only valid combo per your spec
  if (!(username === "chris" && password === "badcommand")) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid credentials" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: "chris", iat: now, exp: now + 7 * 24 * 60 * 60 }; // 7 days
  const token = await signSession(payload, env.AUTH_SECRET);

  return new Response(JSON.stringify({ ok: true, user: "chris" }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": setCookie("session", token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 }),
    },
  });
}

async function logout(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": setCookie("session", "", { httpOnly: true, maxAge: 0 }),
    },
  });
}

async function me(request: Request, env: Env): Promise<Response> {
  const cookies = parseCookies(request);
  const token = cookies["session"];
  if (!token) return new Response("Unauthorized", { status: 401 });

  const payload = await verifySession(token, env.AUTH_SECRET);
  if (!payload) return new Response("Unauthorized", { status: 401 });

  return new Response(JSON.stringify({ user: payload.sub }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function validEmail(email: string): boolean {
  // pragmatic, not perfect
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function notifyDownload(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const path = (body.path || "").toString();
  const email = (body.email || "").toString();

  if (!path) return new Response("Missing path", { status: 400 });
  if (!validEmail(email)) return new Response("Invalid email", { status: 400 });

  const toEmail = env.SUPPORT_EMAIL || "support@chrisbrighouse.com";
  const fromEmail = env.FROM_ADDRESS || "Downloads <no-reply@brighouse.com>";

  const payload = {
    personalizations: [
      {
        to: [{ email: toEmail }],
      },
    ],
    from: { email: fromEmail },
    reply_to: { email },
    subject: `Download: ${path}`,
    content: [
      {
        type: "text/plain",
        value:
          `A file was downloaded.\n\n` +
          `File: ${path}\n` +
          `User email: ${email}\n` +
          `Time (UTC): ${new Date().toISOString()}\n`,
      },
    ],
  };

  // Use MailChannels (works on CF Workers without extra libs)
  const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (resp.ok) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const text = await resp.text().catch(() => "Mail send failed");
  return new Response(JSON.stringify({ ok: false, error: text }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });
}
