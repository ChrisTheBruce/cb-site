// worker/router.ts
import { emailRoutes } from "./handlers/email";

export interface Env {
  // Optional cookie name override used by handlers/email.ts
  DL_EMAIL_COOKIE_NAME?: string;

  // You can add other env bindings here (KV, secrets, etc.) as needed.
  // MAILCHANNELS_KEY?: string;
}

/* ------------ small helpers -------------- */

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

function corsHeaders(req: Request): Headers {
  const h = new Headers();
  const origin = req.headers.get("Origin") || "*";
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", "content-type,authorization");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

function withCors(req: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  const cors = corsHeaders(req);
  for (const [k, v] of cors.entries()) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

function handleOptions(req: Request): Response {
  // CORS preflight
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/* --------- /api/download-notify (minimal) ---------- */
/* Accepts POSTs from navigator.sendBeacon or fetch(keepalive) */
async function downloadNotifyHandler(req: Request, _env: Env): Promise<Response> {
  let payload: any = {};
  try {
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      payload = await req.json();
    }
  } catch {
    // ignore parse errors, keep payload {}
  }

  // Log a compact line for Wrangler tail correlation
  try {
    const { path, title, email, ts, ua } = payload || {};
    console.log(
      "notify: download",
      JSON.stringify({ path, title, email, ts, ua, reqId: req.headers.get("cf-ray") || null })
    );
  } catch {
    // ignore logging failures
  }

  // If you later wire MailChannels, enqueue it here and still return fast.
  return json({ ok: true }, { status: 200 });
}

/* --------------- main fetch router ---------------- */

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    // Email routes (/api/email, /api/email/clear)
    const emailRes = await emailRoutes(request, env);
    if (emailRes) return withCors(request, emailRes);

    // Other API routes
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/download-notify") {
      const res = await downloadNotifyHandler(request, env);
      return withCors(request, res);
    }

    // Fallback
    return withCors(request, new Response("Not found", { status: 404 }));
  },
};
