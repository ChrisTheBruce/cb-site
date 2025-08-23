// index.ts — hardened API + auth + caching for chris.brighouse.com
// - API-first routing with try/catch (no unhandled 500s)
// - Auth is separate from downloads email cookie
// - /api/login sets an HttpOnly auth cookie (demo-grade)
// - /api/me returns 200 when auth cookie exists, else 401
// - /api/logout clears auth cookies
// - /api/notify-download(s) returns 202; email send in background
// - Server-side notify on GET /assets/*
// - HTML no-store, static assets long cache
//
// Replace your current Worker entry with this. Adjust env vars in wrangler.toml if needed.

interface Env {
  ASSETS: Fetcher;
  EMAIL_PROVIDER?: string;
  SUPPORT_TO_EMAIL?: string;
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
  RESEND_API_KEY?: string;
  CORS_ORIGIN?: string;
}

const DOWNLOAD_EMAIL_COOKIE = "cb_email";
const AUTH_COOKIE_NAMES = ["cb_auth", "session", "auth", "auth_token"] as const;
const PRIMARY_AUTH_COOKIE = "cb_auth";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);
      const origin = url.origin;
      const pathname = url.pathname;

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors(env, origin) });
      }

      // -------- API (handled before static) --------
      if (pathname.startsWith("/api/")) {
        try {
          // ---- LOGIN ----
          if (pathname === "/api/login" && req.method === "POST") {
            const body = await readBody(req);
            const username = (body.username || body.email || "").toString().trim();
            const password = (body.password || "").toString();

            // Strict demo auth: only allow username "chris" and password "badcommand"
            if (username !== "chris" || password !== "badcommand") {
              return json({ ok: false, error: "Invalid username or password." }, 401, env, origin);
            }

            const token = makeToken(username);
            const headers = new Headers({ "content-type": "application/json", ...cors(env, origin) });
            for (const d of cookieDomains(url.hostname)) {
              headers.append("Set-Cookie", cookieString(PRIMARY_AUTH_COOKIE, token, { domain: d }));
            }
            headers.append("Set-Cookie", cookieString(PRIMARY_AUTH_COOKIE, token));

            return new Response(JSON.stringify({ ok: true, authenticated: true, username }), { status: 200, headers });
          }

          // ---- ME ----
          if (pathname === "/api/me" && req.method === "GET") {
            const { token, name } = readAuthFromCookie(req.headers.get("Cookie") || "");
            if (!token) return json({ authenticated: false }, 401, env, origin);
            return json({ authenticated: true, username: name || "user" }, 200, env, origin);
          }

          // ---- LOGOUT ----
          if (pathname === "/api/logout" && req.method === "POST") {
            const headers = new Headers({ "content-type": "application/json", ...cors(env, origin) });
            for (const n of AUTH_COOKIE_NAMES) {
              for (const d of cookieDomains(url.hostname)) {
                headers.append("Set-Cookie", clearCookieString(n, { domain: d }));
              }
              headers.append("Set-Cookie", clearCookieString(n));
            }
            return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
          }

          // ---- CLEAR DOWNLOAD EMAIL ONLY ----
          if (pathname === "/api/clear-email" && req.method === "POST") {
            const headers = new Headers({ "content-type": "application/json", ...cors(env, origin) });
            for (const d of cookieDomains(url.hostname)) {
              headers.append("Set-Cookie", clearCookieString(DOWNLOAD_EMAIL_COOKIE, { domain: d }));
            }
            headers.append("Set-Cookie", clearCookieString(DOWNLOAD_EMAIL_COOKIE));
            return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
          }

          // ---- NOTIFY (client) ----
          const isNotify = (pathname === "/api/notify-download" || pathname === "/api/notify-downloads") && req.method === "POST";
          if (isNotify) {
            const cookieEmail = readDownloadEmailFromCookie(req.headers.get("Cookie") || "");
            const body = await readBody(req);
            const email = (body.email || cookieEmail || "").toString();
            const file = (body.file || body.href || body.path || "").toString();
            const title = (body.title || "").toString();
            const ua = req.headers.get("user-agent") || "";
            const ip = req.headers.get("cf-connecting-ip") || "";
            const referer = req.headers.get("referer") || "";
            if (!file) return json({ ok: false, error: "missing file" }, 200, env, origin);

            const to = env.SUPPORT_TO_EMAIL || "support@chrisbrighouse.com";
            const fromEmail = env.SENDER_EMAIL || `no-reply@${url.hostname}`;
            const fromName = env.SENDER_NAME || "Downloads";
            const subject = `Download: ${file}`;
            const text =
              `A file was downloaded.\n\nFile: ${file}\n` +
              (title ? `Title: ${title}\n` : "") +
              `Email: ${email || "(unknown)"}\nReferrer: ${referer}\nUser-Agent: ${ua}\nIP: ${ip}\nTime: ${new Date().toISOString()}\n`;

            ctx.waitUntil((async () => {
              const res = await sendEmail(env, { to, fromEmail, fromName, subject, text });
              if (!res.ok) console.error("notify-downloads send failed:", res.error);
            })());
            return json({ ok: true }, 202, env, origin);
          }

          // Unknown API
          return json({ error: "Not found" }, 404, env, origin);
        } catch (apiErr: any) {
          console.error("API handler error:", apiErr?.stack || apiErr?.message || apiErr);
          return json({ ok: false, error: "internal" }, 500, env, origin);
        }
      }

      // -------- Server-side asset notify (defensive) --------
      if (req.method === "GET" && pathname.startsWith("/assets/")) {
        const cookieEmail = readDownloadEmailFromCookie(req.headers.get("Cookie") || "");
        const to = env.SUPPORT_TO_EMAIL || "support@chrisbrighouse.com";
        const fromEmail = env.SENDER_EMAIL || `no-reply@${url.hostname}`;
        const fromName = env.SENDER_NAME || "Downloads";
        const subject = `Download (server-side): ${pathname}`;
        const ua = req.headers.get("user-agent") || "";
        const ip = req.headers.get("cf-connecting-ip") || "";
        const referer = req.headers.get("referer") || "";
        const text =
          `A file was downloaded (server detected).\n\nFile: ${pathname}\nEmail: ${cookieEmail || "(unknown)"}\n` +
          `Referrer: ${referer}\nUser-Agent: ${ua}\nIP: ${ip}\nTime: ${new Date().toISOString()}\n`;
        ctx.waitUntil((async () => {
          const res = await sendEmail(env, { to, fromEmail, fromName, subject, text });
          if (!res.ok) console.error("server-side notify send failed:", res.error);
        })());
      }

      // -------- Static + SPA --------
      if (!env.ASSETS || !env.ASSETS.fetch) {
        // In case ASSETS binding is missing, fail loudly but clearly.
        return new Response("ASSETS binding not configured", {
          status: 500,
          headers: { "content-type": "text/plain", ...cors(env, origin) },
        });
      }

      let res = await env.ASSETS.fetch(req);

      // SPA fallback: 404 on route-looking path => serve index
      if (res.status === 404 && req.method === "GET" && !/\.[a-z0-9]+$/i.test(pathname)) {
        res = await env.ASSETS.fetch(new Request(new URL("/", url).toString(), req));
      }

      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        const h = new Headers(res.headers);
        h.set("Cache-Control", "no-store");
        return withCors(new Response(res.body, { status: res.status, headers: h }), env, origin);
      }

      if (!res.headers.has("Cache-Control") && isLikelyStatic(pathname)) {
        const h = new Headers(res.headers);
        h.set("Cache-Control", "public, max-age=31536000, immutable");
        res = new Response(res.body, { status: res.status, headers: h });
      }

      return withCors(res, env, origin);
    } catch (err: any) {
      // last-resort error handler
      console.error("Worker top-level error:", err?.stack || err?.message || err);
      return new Response(JSON.stringify({ ok: false, error: "fatal" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },
};

// -------------- helpers --------------

function readDownloadEmailFromCookie(cookieHeader: string): string {
  const m = cookieHeader.match(new RegExp(`(?:^|; )${DOWNLOAD_EMAIL_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function readAuthFromCookie(cookieHeader: string): { token: string; name?: string } {
  for (const n of AUTH_COOKIE_NAMES) {
    const m = cookieHeader.match(new RegExp(`(?:^|; )${n}=([^;]*)`));
    if (m) {
      const val = decodeURIComponent(m[1]);
      const isEmail = /@/.test(val);
      return { token: val, name: isEmail ? val : undefined };
    }
  }
  return { token: "" };
}

function cookieDomains(hostname: string): string[] {
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    const etld1 = parts.slice(-2).join(".");
    return [hostname, "." + etld1];
  }
  return [hostname];
}

function cookieString(name: string, value: string, opts?: { domain?: string }) {
  const expires = new Date(Date.now() + 180 * 24 * 3600 * 1000).toUTCString();
  const base = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax; Secure`;
  return opts?.domain ? `${base}; Domain=${opts.domain}` : base;
}
function clearCookieString(name: string, opts?: { domain?: string }) {
  const base = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure`;
  return opts?.domain ? `${base}; Domain=${opts.domain}` : base;
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

function makeToken(username: string): string {
  // Non-cryptographic demo token: username + random. Replace with real sign/JWT later.
  const rand = Math.random().toString(36).slice(2);
  return `${username}.${rand}`;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) return await req.json();
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const out: Record<string, unknown> = {};
      for (const [k, v] of form.entries()) out[k] = v;
      return out;
    }
    const txt = await req.text();
    if (!txt) return {};
    try { return JSON.parse(txt); } catch { return { text: txt }; }
  } catch {
    return {};
  }
}

// -------- email providers --------

async function sendEmail(env: Env, args: { to: string; fromEmail: string; fromName?: string; subject: string; text: string; }): Promise<{ ok: boolean; error?: string; }> {
  const provider = (env.EMAIL_PROVIDER || "mailchannels").toLowerCase();
  if (provider === "resend") return sendViaResend(env, args);
  if (provider === "log")  return sendViaLog(args);
  return sendViaMailChannels(env, args);
}

async function sendViaLog({ to, fromEmail, fromName, subject, text }: { to: string; fromEmail: string; fromName?: string; subject: string; text: string; }): Promise<{ ok: boolean; error?: string; }> {
  console.log("[EMAIL:log]", { to, fromEmail, fromName, subject, text });
  return { ok: true };
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
