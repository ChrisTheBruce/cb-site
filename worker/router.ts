// worker/router.ts
import { DBG } from "./env";           // your existing logger
import { emailRoutes } from "./handlers/email";

export interface Env {
  DL_EMAIL_COOKIE_NAME?: string;
  DEBUG_MODE?: string; // "1" | "true" | "yes" | "on"
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

function withCorsAndSig(req: Request, res: Response): Response {
  const headers = new Headers(res.headers);
  const cors = corsHeaders(req);
  for (const [k, v] of cors.entries()) headers.set(k, v);
  headers.set("X-CB-Router", "1"); // signature header to prove this router handled it
  return new Response(res.body, { status: res.status, headers });
}

function handleOptions(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function ridOf(req: Request): string {
  return req.headers.get("cf-ray") || "";
}

/* ---------- cookie helpers (inline) ---------- */
function apexFromHost(hostname: string): string | null {
  if (!hostname || hostname === "localhost" || /^[0-9.]+$/.test(hostname)) return null;
  if (hostname.endsWith(".workers.dev")) return null;
  if (hostname.startsWith("www.")) return hostname.slice(4);
  const parts = hostname.split(".");
  if (parts.length >= 3) return parts.slice(-2).join(".");
  return null;
}

function expireCookie(name: string, domain?: string): string {
  const bits = [
    `${name}=`,
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Secure",
  ];
  if (domain) bits.splice(1, 0, `Domain=${domain}`);
  return bits.join("; ");
}

/* --------- /api/download-notify (minimal) ---------- */
function maskEmail(e?: string): string | undefined {
  if (!e || typeof e !== "string") return undefined;
  const [user, dom] = e.split("@");
  if (!dom) return e;
  if ((user ?? "").length <= 2) return `${user?.[0] || "*"}***@${dom}`;
  return `${user.slice(0, 2)}***@${dom}`;
}

async function downloadNotifyHandler(req: Request, _env: Env): Promise<Response> {
  let payload: any = {};
  try {
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      payload = await req.json();
    }
  } catch { /* ignore */ }

  try {
    const { path, title, email, ts, ua } = payload || {};
    DBG("hit /api/download-notify", JSON.stringify({
      rid: ridOf(req),
      path,
      title,
      email: maskEmail(email),
      ts,
      ua,
    }));
  } catch { /* ignore */ }

  return json({ ok: true }, { status: 200 });
}

/* --------------- main fetch router ---------------- */

export async function handleApi(
  request: Request,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  DBG("enter router", JSON.stringify({ rid: ridOf(request), method: request.method, path: url.pathname }));

  try {
    if (request.method === "OPTIONS") {
      DBG("CORS preflight", JSON.stringify({ rid: ridOf(request) }));
      return handleOptions(request);
    }

    // ---- Healthcheck / signature ----
    if (request.method === "GET" && url.pathname === "/api/ping") {
      DBG("hit /api/ping", JSON.stringify({ rid: ridOf(request) }));
      const resp = json({ ok: true, router: "cb", ts: Date.now() }, { status: 200 });
      return withCorsAndSig(request, resp);
    }

    // ---- HARDENED: clear email route handled inline first ----
    if (request.method === "POST" && url.pathname === "/api/email/clear") {
      DBG("hit /api/email/clear (inline)", JSON.stringify({ rid: ridOf(request) }));

      const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
      try {
        const host = url.hostname;
        const apex = apexFromHost(host);
        const name = env.DL_EMAIL_COOKIE_NAME || "dl_email";
        const allNames = [name, "DL_EMAIL", "cb_dl_email"];

        DBG("clearing cookies", JSON.stringify({ rid: ridOf(request), host, apex, names: allNames }));

        for (const n of allNames) {
          headers.append("Set-Cookie", expireCookie(n));           // host-scoped
          if (apex) headers.append("Set-Cookie", expireCookie(n, apex)); // apex-scoped
        }
      } catch (e) {
        DBG("inline clear error", String((e as any)?.message || e));
      }

      return withCorsAndSig(
        request,
        new Response(JSON.stringify({ ok: true }), { status: 200, headers })
      );
    }

    // Email routes (/api/email, etc.)
    const emailRes = await emailRoutes(request, env);
    if (emailRes) {
      DBG("emailRoutes handled", JSON.stringify({ rid: ridOf(request), path: url.pathname }));
      return withCorsAndSig(request, emailRes);
    }

    // Runtime debug config for the client (used by main.jsx)
    if (request.method === "GET" && url.pathname === "/api/debug-config") {
      const body = { debug: ["1","true","yes","on"].includes(String(env.DEBUG_MODE ?? "").toLowerCase()) };
      DBG("hit /api/debug-config", JSON.stringify({ rid: ridOf(request), body }));
      const resp = json(body, { headers: { "cache-control": "no-store" } });
      return withCorsAndSig(request, resp);
    }

    // Download notify endpoint
    if (request.method === "POST" && url.pathname === "/api/download-notify") {
      const res = await downloadNotifyHandler(request, env);
      return withCorsAndSig(request, res);
    }

    DBG("fallback 404", JSON.stringify({ rid: ridOf(request), path: url.pathname }));
    return withCorsAndSig(request, new Response("Not found", { status: 404 }));
  } catch (err: any) {
    const rid = ridOf(request) || (globalThis as any).crypto?.randomUUID?.() || "no-ray";
    DBG("router fatal", JSON.stringify({ rid, err: err?.message || String(err) }));
    return withCorsAndSig(
      request,
      json({ ok: false, error: "Internal error", rid }, { status: 500 })
    );
  }
}

export default { fetch: handleApi };
