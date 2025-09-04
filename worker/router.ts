// worker/router.ts
import { emailRoutes } from "./handlers/email";

export interface Env {
  DL_EMAIL_COOKIE_NAME?: string;
  DEBUG_MODE?: string;
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
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function toBool(x: any): boolean {
  const s = String(x ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/* ---------- cookie helpers (inline, no throws) ---------- */
function apexFromHost(hostname: string): string | null {
  if (!hostname || hostname === "localhost" || /^[0-9.]+$/.test(hostname)) return null;
  if (hostname.endsWith(".workers.dev")) return null;
  if (hostname.startsWith("www.")) return hostname.slice(4);
  const parts = hostname.split(".");
  if (parts.length >= 3) return parts.slice(-2).join(".");
  return null;
}

function expireCookie(name: string, domain?: string): string {
  const bits = [`${name}=`, "Path=/", "SameSite=Lax", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "Secure"];
  if (domain) bits.splice(1, 0, `Domain=${domain}`);
  return bits.join("; ");
}

/* --------- /api/download-notify (minimal) ---------- */
async function downloadNotifyHandler(req: Request, _env: Env): Promise<Response> {
  let payload: any = {};
  try {
    if ((req.headers.get("content-type") || "").includes("application/json")) {
      payload = await req.json();
    }
  } catch {
    // ignore
  }
  try {
    const { path, title, email, ts, ua } = payload || {};
    console.log("notify: download", JSON.stringify({ path, title, email, ts, ua, reqId: req.headers.get("cf-ray") || null }));
  } catch {}
  return json({ ok: true }, { status: 200 });
}

/* --------------- main fetch router ---------------- */

export async function handleApi(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    const url = new URL(request.url);

    // ---- HARDENED: clear email route handled inline first ----
    if (request.method === "POST" && url.pathname === "/api/email/clear") {
      const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
      try {
        const host = url.hostname;
        const apex = apexFromHost(host);
        const name = env.DL_EMAIL_COOKIE_NAME || "dl_email";
        const allNames = [name, "DL_EMAIL", "cb_dl_email"];

        for (const n of allNames) {
          headers.append("Set-Cookie", expireCookie(n));              // host-scoped
          if (apex) headers.append("Set-Cookie", expireCookie(n, apex)); // apex-scoped
        }
      } catch (e) {
        // swallow – still return 200 to avoid client UX break
        console.log("inline clear error", (e as any)?.message || e);
      }
      return withCors(request, new Response(JSON.stringify({ ok: true }), { status: 200, headers }));
    }

    // Email routes (/api/email and friends)
    const emailRes = await emailRoutes(request, env);
    if (emailRes) return withCors(request, emailRes);

    // Runtime debug config for the client (used by main.jsx)
    if (request.method === "GET" && url.pathname === "/api/debug-config") {
      const resp = json({ debug: toBool(env.DEBUG_MODE) }, { headers: { "cache-control": "no-store" } });
      return withCors(request, resp);
    }

    if (request.method === "POST" && url.pathname === "/api/download-notify") {
      const res = await downloadNotifyHandler(request, env);
      return withCors(request, res);
    }

    return withCors(request, new Response("Not found", { status: 404 }));
  } catch (err: any) {
    // Final safety net: never leak stack; add a ray id for correlation
    const rid = request.headers.get("cf-ray") || crypto.randomUUID?.() || "no-ray";
    console.log("router fatal", rid, err?.message || err);
    return withCors(
      request,
      json({ ok: false, error: "Internal error", rid }, { status: 500 })
    );
  }
}

// Also export default for Workers that expect it.
export default { fetch: handleApi };
