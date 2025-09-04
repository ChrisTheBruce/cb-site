// worker/router.ts
import { emailRoutes } from "./handlers/email";
import * as EnvMod from "./env"; // pulls DBG if present

export interface Env {
  DL_EMAIL_COOKIE_NAME?: string;
  DEBUG_MODE?: string; // "1"/"true"/"yes"/"on"
}

const DBG: (...args: any[]) => void =
  typeof (EnvMod as any)?.DBG === "function" ? (EnvMod as any).DBG : (...a: any[]) => {
    try { console.log(...a); } catch {}
  };

/* ------------ helpers -------------- */

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
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

function withCorsAndSig(req: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  const cors = corsHeaders(req);
  for (const [k, v] of cors.entries()) headers.set(k, v);
  headers.set("X-CB-Router", "1");
  return new Response(res.body, { status: res.status, headers });
}

function handleOptions(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function ridOf(req: Request): string {
  return req.headers.get("cf-ray") || "";
}

function toBool(x: any): boolean {
  const s = String(x ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/* ---------- cookie helpers ---------- */
function apexFromHost(hostname: string): string | null {
  if (!hostname || hostname === "localhost" || /^[0-9.]+$/.test(hostname)) return null;
  if (hostname.endsWith(".workers.dev")) return null;
  if (hostname.startsWith("www.")) return hostname.slice(4);
  const parts = hostname.split(".");
  if (parts.length >= 3) return parts.slice(-2).join(".");
  return null;
}

function expireCookie(name: string, domain?: string): string {
  const parts = [
    `${name}=`,
    domain ? `Domain=${domain}` : "",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Secure",
  ].filter(Boolean);
  return parts.join("; ");
}

/* ---------- /api/download-notify ---------- */
function maskEmail(e?: string): string | undefined {
  if (!e || typeof e !== "string") return undefined;
  const [u, d] = e.split("@");
  if (!d) return e;
  if ((u ?? "").length <= 2) return `${u?.[0] || "*"}***@${d}`;
  return `${u.slice(0, 2)}***@${d}`;
}

async function downloadNotifyHandler(req: Request): Promise<Response> {
  let payload: any = {};
  try {
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      payload = await req.json();
    }
  } catch {}
  try {
    const { path, title, email, ts, ua } = payload || {};
    DBG("hit /api/download-notify", JSON.stringify({
      rid: ridOf(req), path, title, email: maskEmail(email), ts, ua,
    }));
  } catch {}
  return json({ ok: true }, { status: 200 });
}

/* --------------- main fetch router ---------------- */

export async function handleApi(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(request.url);

    // 🔒 SAFETY: if this Worker is (accidentally) bound to the whole zone,
    // pass through any non-/api/* requests to your site so pages still load.
    if (!url.pathname.startsWith("/api/")) {
      DBG("passthrough non-API", JSON.stringify({ path: url.pathname, rid: ridOf(request) }));
      return fetch(request);
    }

    DBG("enter API router", JSON.stringify({ method: request.method, path: url.pathname, rid: ridOf(request) }));

    if (request.method === "OPTIONS") {
      DBG("CORS preflight", JSON.stringify({ path: url.pathname, rid: ridOf(request) }));
      return handleOptions(request);
    }

    // Healthcheck
    if (request.method === "GET" && url.pathname === "/api/ping") {
      DBG("hit /api/ping", JSON.stringify({ rid: ridOf(request) }));
      return withCorsAndSig(request, json({ ok: true, router: "cb", ts: Date.now() }, { status: 200 }));
    }

    // Inline, hardened clear (always 200)
    if (request.method === "POST" && url.pathname === "/api/email/clear") {
      DBG("hit /api/email/clear (inline)", JSON.stringify({ rid: ridOf(request) }));
      const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
      try {
        const host = url.hostname;
        const apex = apexFromHost(host);
        const name = env.DL_EMAIL_COOKIE_NAME || "dl_email";
        const all = [name, "DL_EMAIL", "cb_dl_email"];
        DBG("clearing cookies", JSON.stringify({ host, apex, names: all, rid: ridOf(request) }));
        for (const n of all) {
          headers.append("Set-Cookie", expireCookie(n));
          if (apex) headers.append("Set-Cookie", expireCookie(n, apex));
        }
      } catch (e) {
        DBG("inline clear error", String((e as any)?.message || e));
      }
      return withCorsAndSig(request, new Response(JSON.stringify({ ok: true }), { status: 200, headers }));
    }

    // Other email routes (e.g., /api/email)
    const emailRes = await emailRoutes(request, env);
    if (emailRes) {
      DBG("emailRoutes handled", JSON.stringify({ path: url.pathname, rid: ridOf(request) }));
      return withCorsAndSig(request, emailRes);
    }

    // Debug config for client
    if (request.method === "GET" && url.pathname === "/api/debug-config") {
      const body = { debug: toBool(env.DEBUG_MODE) };
      DBG("hit /api/debug-config", JSON.stringify({ body, rid: ridOf(request) }));
      return withCorsAndSig(request, json(body, { headers: { "cache-control": "no-store" } }));
    }

    // Download notify
    if (request.method === "POST" && url.pathname === "/api/download-notify") {
      const res = await downloadNotifyHandler(request);
      return withCorsAndSig(request, res);
    }

    DBG("fallback 404", JSON.stringify({ path: url.pathname, rid: ridOf(request) }));
    return withCorsAndSig(request, new Response("Not found", { status: 404 }));
  } catch (err: any) {
    const rid = ridOf(request) || (globalThis as any).crypto?.randomUUID?.() || "no-ray";
    DBG("router fatal", JSON.stringify({ rid, err: err?.message || String(err) }));
    return withCorsAndSig(request, json({ ok: false, error: "Internal error", rid }, { status: 500 }));
  }
}

export default { fetch: handleApi };
