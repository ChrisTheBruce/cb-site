// index.ts — Cloudflare Worker (API-first routing + caching + server-side download notify)
// Why your notify/me weren't firing:
// 1) API routes must be handled *before* ASSETS.fetch() or they get swallowed by the static handler.
// 2) Browser navigation on downloads can cancel client fetches. We fix that by ALSO notifying on the server
//    whenever a GET to /assets/* is requested (ctx.waitUntil). That makes notifications bulletproof.
//
// What this file does:
// - /api/me (GET): returns { username } from 'cb_email' (or 'email') cookie
// - /api/clear-email (POST): expires cookie on hostname and eTLD+1
// - /api/notify-download(s) (POST): accepts JSON/form/beacon; sends email via MailChannels (default) or Resend
// - Server-side notify on asset GET: when pathname starts with /assets/, it will fire a background email
// - CORS + OPTIONS
// - Caching: HTML -> no-store; static hashed assets -> 1y immutable (unless already set)
//
// ENV expected (configure in wrangler):
// - ASSETS: Fetcher binding for your static site
// - SUPPORT_TO_EMAIL: e.g., "support@chrisbrighouse.com"
// - SENDER_EMAIL: verified sender (MailChannels or your domain), e.g., "no-reply@chrisbrighouse.com"
// - SENDER_NAME: optional display name (default "Downloads")
// - EMAIL_PROVIDER: "mailchannels" (default) or "resend"
// - RESEND_API_KEY: required if EMAIL_PROVIDER="resend"
// - CORS_ORIGIN: optional explicit origin (defaults to request origin)

interface Env {
  ASSETS: Fetcher;
  EMAIL_PROVIDER?: string;
  SUPPORT_TO_EMAIL?: string;
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
  RESEND_API_KEY?: string;
  CORS_ORIGIN?: string;
}

const COOKIE_NAME = "cb_email";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const origin = url.origin;
    const pathname = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(env, origin) });
    }

    // ---------- API ROUTES (handled BEFORE ASSETS) ----------
    if (pathname.startsWith("/api/")) {
      if (pathname === "/api/me" && req.method === "GET") {
        const email = readEmailFromCookie(req.headers.get("Cookie") || "");
        return json({ username: email || null }, 200, env, origin);
      }

      if (pathname === "/api/clear-email" && req.method === "POST") {
        const headers = new Headers({ "content-type": "application/json", ...cors(env, origin) });
        for (const d of cookieDomains(url.hostname)) {
          headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; Domain=${d}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure`);
        }
        headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure`);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      const isNotify =
        (pathname === "/api/notify-download" || pathname === "/api/notify-downloads") && req.method === "POST";
      if (isNotify) {
        const cookieEmail = readEmailFromCookie(req.headers.get("Cookie") || "");
        const body = await readBody(req);
        // Accept both client-sent email and cookie email; prefer explicit body.email, fall back to cookie
        const email = (body.email || cookieEmail || "").toString();
        const file = (body.file || body.href || body.path || "").toString();
        const title = (body.title || "").toString();
        const ua = req.headers.get("user-agent") || "";
        const ip = req.headers.get("cf-connecting-ip") || "";
        const referer = req.headers.get("referer") || "";

        // Minimal guard: we at least want a file path
        if (!file) {
          return json({ ok: false, error: "missing file" }, 400, env, origin);
        }

        const to = env.SUPPORT_TO_EMAIL || "support@chrisbrighouse.com";
        const fromEmail = env.SENDER_EMAIL || `no-reply@${new URL(origin).hostname}`;
        const fromName = env.SENDER_NAME || "Downloads";
        const subject = `Download: ${file}`;
        const plain =
          `A file was downloaded.\n\n` +
          `File: ${file}\n` +
          (title ? `Title: ${title}\n` : "") +
          `Email: ${email || "(unknown)"}\n` +
          `Referrer: ${referer}\n` +
          `User-Agent: ${ua}\n` +
          `IP: ${ip}\n` +
          `Time: ${new Date().toISOString()}\n`;

        const sendResult = await sendEmail(env, { to, fromEmail, fromName, subject, text: plain });
        if (!sendResult.ok) {
          return json({ ok: false, error: sendResult.error || "email send failed" }, 502, env, origin);
        }
        return json({ ok: true }, 200, env, origin);
      }

      return json({ error: "Not found" }, 404, env, origin);
    }

    // ---------- SERVER-SIDE DOWNLOAD NOTIFY (bulletproof) ----------
    // If the user hits a static asset under /assets/* directly, we send a background notification.
    if (req.method === "GET" && pathname.startsWith("/assets/")) {
      const cookieEmail = readEmailFromCookie(req.headers.get("Cookie") || "");
      const to = env.SUPPORT_TO_EMAIL || "support@chrisbrighouse.com";
      const fromEmail = env.SENDER_EMAIL || `no-reply@${url.hostname}`;
      const fromName = env.SENDER_NAME || "Downloads";
      const subject = `Download (server-side): ${pathname}`;
      const ua = req.headers.get("user-agent") || "";
      const ip = req.headers.get("cf-connecting-ip") || "";
      const referer = req.headers.get("referer") || "";
      const text =
        `A file was downloaded (server detected).\n\n` +
        `File: ${pathname}\n` +
        `Email: ${cookieEmail || "(unknown)"}\n` +
        `Referrer: ${referer}\n` +
        `User-Agent: ${ua}\n` +
        `IP: ${ip}\n` +
        `Time: ${new Date().toISOString()}\n`;
      // Fire and forget
      ctx.waitUntil(sendEmail(env, { to, fromEmail, fromName, subject, text }));
    }

    // ---------- STATIC ASSETS + SPA FALLBACK ----------
    // Serve assets. If 404 and it's an SPA route (no file extension), fall back to root.
    let res = await env.ASSETS.fetch(req);
    if (res.status === 404 && req.method === "GET" && !/\.[a-z0-9]+$/i.test(pathname)) {
      const ix = new URL("/", url);
      res = await env.ASSETS.fetch(new Request(ix.toString(), req));
    }

    // HTML shell must never be cached
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const h = new Headers(res.headers);
      h.set("Cache-Control", "no-store");
      return withCors(new Response(res.body, { status: res.status, headers: h }), env, origin);
    }

    // Long cache for versioned static assets if not already set
    if (!res.headers.has("Cache-Control") && isLikelyStatic(pathname)) {
      const h = new Headers(res.headers);
      h.set("Cache-Control", "public, max-age=31536000, immutable");
      res = new Response(res.body, { status: res.status, headers: h });
    }

    return withCors(res, env, origin);
  },
};

// ---------------- helpers ----------------

function readEmailFromCookie(cookieHeader: string): string {
  // read cb_email or email
  const m1 = cookieHeader.match(/(?:^|; )cb_email=([^;]*)/);
  if (m1) return decodeURIComponent(m1[1]);
  const m2 = cookieHeader.match(/(?:^|; )email=([^;]*)/);
  if (m2) return decodeURIComponent(m2[1]);
  return "";
}

function cookieDomains(hostname: string): string[] {
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    const etld1 = parts.slice(-2).join(".");
    return [hostname, "." + etld1];
  }
  return [hostname];
}

function isLikelyStatic(pathname: string): boolean {
  return /\.(?:css|js|mjs|cjs|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|txt|map|pdf)$/i.test(pathname);
}

function cors(env: Env, fallbackOrigin: string) {
  const origin = env.CORS_ORIGIN || fallbackOrigin;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function withCors(res: Response, env: Env, origin: string): Response {
  const h = new Headers(res.headers);
  const c = cors(env, origin);
  for (const [k, v] of Object.entries(c)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

function json(obj: unknown, status: number, env: Env, origin: string): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors(env, origin) },
  });
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  // tolerate beacon, JSON, form, or empty
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      return await req.json();
    }
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const out: Record<string, unknown> = {};
      for (const [k, v] of form.entries()) out[k] = v;
      return out;
    }
    // Text from sendBeacon (often text/plain)
    const txt = await req.text();
    if (!txt) return {};
    try { return JSON.parse(txt); } catch { return { text: txt }; }
  } catch {
    return {};
  }
}

// ---------------- email senders ----------------

async function sendEmail(env: Env, args: { to: string; fromEmail: string; fromName?: string; subject: string; text: string; }): Promise<{ ok: boolean; error?: string; }> {
  const provider = (env.EMAIL_PROVIDER || "mailchannels").toLowerCase();
  if (provider === "resend") return sendViaResend(env, args);
  return sendViaMailChannels(env, args);
}

async function sendViaMailChannels(env: Env, { to, fromEmail, fromName, subject, text }: { to: string; fromEmail: string; fromName?: string; subject: string; text: string; }): Promise<{ ok: boolean; error?: string; }> {
  try {
    const mcResp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName || "Downloads" },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
    if (!mcResp.ok) {
      const errTxt = await mcResp.text().catch(() => "");
      return { ok: false, error: `mailchannels ${mcResp.status}: ${errTxt}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "mailchannels error" };
  }
}

async function sendViaResend(env: Env, { to, fromEmail, fromName, subject, text }: { to: string; fromEmail: string; fromName?: string; subject: string; text: string; }): Promise<{ ok: boolean; error?: string; }> {
  const key = env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY missing" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [to],
        subject,
        text,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, error: `resend ${r.status}: ${t}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "resend error" };
  }
}
