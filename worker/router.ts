// worker/router.ts
import type { Env } from "./env";

/** Minimal CORS helpers */
function corsify(res: Response, origin?: string) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", origin || "*");
  h.set("Access-Control-Allow-Credentials", "true");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(res.body, { status: res.status, headers: h });
}
function empty204(origin?: string) {
  return corsify(new Response(null, { status: 204 }), origin);
}

/** Resolve a handler function from a module with flexible export names */
function pickHandler(mod: any, preferred: string[]): ((req: Request, env: Env) => Promise<Response> | Response) | null {
  for (const name of preferred) {
    const fn = mod?.[name];
    if (typeof fn === "function") return fn;
  }
  // common fallbacks
  if (typeof mod?.default === "function") return mod.default;
  if (typeof mod?.handle === "function") return mod.handle;
  if (typeof mod?.fetch === "function") return mod.fetch;
  return null;
}

/** Main API router (exported name must match worker/index.ts import) */
export async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const origin = req.headers.get("Origin") || undefined;

  if (!path.startsWith("/api/")) {
    return corsify(new Response("Not an API route", { status: 404 }), origin);
  }

  if (req.method === "OPTIONS") {
    return empty204(origin);
  }

  // ---- /api/health ----
  if (path === "/api/health") {
    // Dynamically import to avoid build-time name mismatches
    const mod = await import("./handlers/health");
    const fn = pickHandler(mod, ["health", "get"]);
    const res = typeof fn === "function" ? await fn(req, env) : new Response("ok", { status: 200 });
    return corsify(res, origin);
  }

  // ---- AUTH primary paths (/api/auth/*) ----
  if (path === "/api/auth/me" && req.method === "GET") {
    const mod = await import("./handlers/auth");
    const fn = pickHandler(mod, ["me"]);
    const res = fn ? await fn(req, env) : new Response("Missing auth.me handler", { status: 500 });
    return corsify(res, origin);
  }
  if (path === "/api/auth/login" && req.method === "POST") {
    const mod = await import("./handlers/auth");
    const fn = pickHandler(mod, ["login"]);
    const res = fn ? await fn(req, env) : new Response("Missing auth.login handler", { status: 500 });
    return corsify(res, origin);
  }
  if (path === "/api/auth/logout" && req.method === "POST") {
    const mod = await import("./handlers/auth");
    const fn = pickHandler(mod, ["logout"]);
    const res = fn ? await fn(req, env) : new Response("Missing auth.logout handler", { status: 500 });
    return corsify(res, origin);
  }

  // ---- AUTH friendly aliases (/api/*) ----
  if (path === "/api/me" && req.method === "GET") {
    const mod = await import("./handlers/auth");
    const fn = pickHandler(mod, ["me"]);
    const res = fn ? await fn(req, env) : new Response("Missing auth.me handler", { status: 500 });
    return corsify(res, origin);
  }
  if (path === "/api/login" && req.method === "POST") {
    const mod = await import("./handlers/auth");
    const fn = pickHandler(mod, ["login"]);
    const res = fn ? await fn(req, env) : new Response("Missing auth.login handler", { status: 500 });
    return corsify(res, origin);
  }
  if (path === "/api/logout" && req.method === "POST") {
    const mod = await import("./handlers/auth");
    const fn = pickHandler(mod, ["logout"]);
    const res = fn ? await fn(req, env) : new Response("Missing auth.logout handler", { status: 500 });
    return corsify(res, origin);
  }

  // ---- EMAIL (Downloads flow) ----
  if (path === "/api/email" && req.method === "POST") {
    const mod = await import("./handlers/email");
    const fn = pickHandler(mod, ["email", "post", "send"]);
    const res = fn ? await fn(req, env) : new Response("Missing email handler", { status: 500 });
    return corsify(res, origin);
  }

  // ---- NOTIFY (Downloads flow) ----
  if (path === "/api/notify" && req.method === "POST") {
    const mod = await import("./handlers/notify");
    const fn = pickHandler(mod, ["notify", "post", "send"]);
    const res = fn ? await fn(req, env) : new Response("Missing notify handler", { status: 500 });
    return corsify(res, origin);
  }

  // ---- 404 for unknown /api/* routes ----
  return corsify(new Response(`No route: ${path}`, { status: 404 }), origin);
}

/**
 * If your worker/index.ts expects a default export, mirror it here:
 * export default { fetch: (req: Request, env: Env) => handleApi(req, env) };
 */
