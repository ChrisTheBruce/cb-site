// index.ts — Cloudflare Worker (Modules syntax)

export interface Env {
  ASSETS: Fetcher;

  // Vars from wrangler.jsonc (non-secrets)
  CORS_ORIGIN?: string;              // e.g., "https://chrisbrighouse.com"
  SENDER_EMAIL?: string;             // e.g., "no-reply@chrisbrighouse.com"
  SENDER_NAME?: string;              // e.g., "Downloads"
  SUPPORT_TO_EMAIL?: string;         // e.g., "support@chrisbrighouse.com"

  // Secrets: set in CF dashboard (Workers → Settings → Variables → Add secret)
  RESEND_API_KEY?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const JSON_OK = (obj: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });

const JSON_ERR = (status: number, message: string) =>
  JSON_OK({ error: message }, { status });

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function corsHeaders(req: Request, env: Env) {
  // If CORS_ORIGIN is set, use it; else reflect the request Origin (safer than "*")
  const origin = env.CORS_ORIGIN || req.headers.get("origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "origin",
  };
}

function withCORS(req: Request, res: Response, env: Env) {
  const h = new Headers(res.headers);
  const extra = corsHeaders(req, env);
  Object.entries(extra).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}

// Accept JSON and forms; tolerate key variants
async function readNotifyBody(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    try {
      return await req.json();
    } catch {
      // fall through
    }
  }

  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const obj: Record<string, any> = {};
    for (const [k, v] of fd.entries()) obj[k] = typeof v === "string" ? v : String(v);
    return obj;
  }

  // Last-chance: URL-encoded text body
  try {
    const text = await req.text();
    if (text && text.includes("=")) {
      const sp = new URLSearchParams(text);
      const obj: Record<string, any> = {};
      for (const [k, v] of sp.entries()) obj[k] = v;
      return obj;
    }
  } catch {
    // ignore
  }

  return {};
}

async function sendViaResend(env: Env, subject: string, text: string, html: string) {
  const apiKey = env.RESEND_API_KEY;
  const to = env.SUPPORT_TO_EMAIL || "support@chrisbrighouse.com";
  const from = env.SENDER_EMAIL || "no-reply@chrisbrighouse.com";
  const fromName = env.SENDER_NAME || "Downloads";

  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const payload = {
    from: `${fromName} <${from}>`,
    to: [to],
    subject,
    text,
    html,
  };

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Resend error ${resp.status}: ${body}`);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return withCORS(req, new Response(null, { status: 204 }), env);
    }

    // === Download notify endpoint ===
    if (url.pathname === "/api/notify_download" && req.method === "POST") {
      const body = await readNotifyBody(req);

      const rawEmail = (body.userEmail ?? body.email ?? "").toString().trim();
      const rawName  = (body.fileName  ?? body.filename ?? "").toString().trim();
      const rawUrl   = (body.fileUrl   ?? body.url      ?? "").toString().trim();

      if (!rawEmail || !emailRegex.test(rawEmail)) {
        return withCORS(req, JSON_ERR(400, "Invalid email"), env);
      }
      if (!rawName) {
        return withCORS(req, JSON_ERR(400, "fileName required"), env);
      }

      const when = new Date().toISOString();
      const subject = `Download: ${rawName}`;
      const text =
`A file was downloaded.

File: ${rawName}
URL: ${rawUrl || "(not provided)"}
User email: ${rawEmail}
When: ${when}`;
      const html =
`<p>A file was downloaded.</p>
<ul>
  <li><b>File</b>: ${escapeHtml(rawName)}</li>
  <li><b>URL</b>: ${rawUrl ? escapeHtml(rawUrl) : "(not provided)"}</li>
  <li><b>User email</b>: ${escapeHtml(rawEmail)}</li>
  <li><b>When</b>: ${when}</li>
</ul>`;

      try {
        await sendViaResend(env, subject, text, html);
        return withCORS(req, JSON_OK({ ok: true }), env);
      } catch (err: any) {
        // Don’t block downloads forever: return 200 but surface the error for logs if Resend misconfigured.
        // If you prefer to fail hard, change status to 502.
        console.error("notify_download email error:", err?.message || err);
        return withCORS(req, JSON_OK({ ok: true, warn: "email_send_failed" }), env);
      }
    }

    // Everything else: serve static assets (Vite build) or other routes you added elsewhere.
    return env.ASSETS.fetch(req);
  },
};
