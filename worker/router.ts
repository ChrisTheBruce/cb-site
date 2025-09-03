import type { Env } from "./env";
import { json, notFound, methodNotAllowed } from "./lib/responses";

import * as auth from "./handlers/auth";
import * as email from "./handlers/email";
import * as health from "./handlers/health";
import * as notify from "./handlers/notify";

// Simple CORS helper for /api/*
function withCors(res: Response, origin?: string) {
  const hdrs = new Headers(res.headers);
  hdrs.set("Access-Control-Allow-Origin", origin || "*");
  hdrs.set("Access-Control-Allow-Credentials", "true");
  hdrs.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  hdrs.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(res.body, { status: res.status, headers: hdrs });
}

function okEmptyCors(origin?: string) {
  return withCors(new Response(null, { status: 204 }), origin);
}

export async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Only manage /api/* here. Anything else should be handled upstream.
  if (!path.startsWith("/api/")) {
    return notFound("Not an API route");
  }

  // Global CORS preflight for /api/*
  if (req.method === "OPTIONS") {
    return okEmptyCors(req.headers.get("Origin") || undefined);
  }

  // --- HEALTH ---
  if (path === "/api/health") {
    if (req.method !== "GET") return withCors(methodNotAllowed("GET required"), req.headers.get("Origin") || undefined);
    const res = await health.health(req, env);
    return withCors(res, req.headers.get("Origin") || undefined);
  }

  // --- AUTH (primary paths) ---
  if (path === "/api/auth/me") {
    if (req.method !== "GET") return withCors(methodNotAllowed("GET required"), req.headers.get("Origin") || undefined);
    const res = await auth.me(req, env);
    return withCors(res, req.headers.get("Origin") || undefined);
  }
  if (path === "/api/auth/login") {
    if (req.method !== "POST") return withCors(methodNotAllowed("POST required"), req.headers.get("Origin") || undefined);
    const res = await auth.login(req, env);
    return withCors(res, req.headers.get("Origin") || undefined);
  }
  if (path === "/api/auth/logout") {
    if (req.method !== "POST") return withCors(methodNotAllowed("POST required"), req.headers.get("Origin") || undefined);
    const res = await auth.logout(req, env);
    return withCors(res, req.headers.get("Origin") || undefined);
  }

  // --- AUTH (friendly aliases) ---
  if (path === "/api/me") {
    if (req.method !== "GET") return withCors(methodNotAllowed("GET required"), req.headers.get("Origin") || undefined);
    const res = await auth.me(req, env);
    return withCors(res, req.headers.get("Origin") || undefined);
  }
  if (path === "/api/login") {
    if (req.method !== "POST") return withCors(methodNotAllowed("POST required"), req.headers.get("Origin") || undefined);
    const res = await auth.login(req, env);
    return withCors(res, req.headers.get("Origin") || undefined);
  }
  if (path === "/api/logout") {
    if (req.method !== "POST") return withCors(methodNotAllowed("POST required"), req.headers.get("Origin") || undefined);
    const res = await auth.logout(req, env);
    return withCors(res, req.headers.get("Origin") || undefined);
  }

  // --- EMAIL / NOTIFY (used by Downloads flow) ---
  if (path === "/api/email") {
    // Adjust allowed methods if your handler expects POST only
    if (req.method !== "POST") return withCors(methodNotAllowed("POST required"), req.headers.get("Origin") || undefined);
    const res = await email.email(req, env);
    return withCors(res, req.headers.get("Origin") || undefined);
  }

  if (path === "/api/notify") {
    if (req.method !== "POST") return withCors(methodNotAllowed("POST required"), req.headers.get("Origin") || undefined);
    const res = await notify.notify(req, env);
    return withCors(res, req.headers.get("Origin") || undefined);
  }

  // Default 404 for unknown /api/* routes
  return withCors(notFound(`No route: ${path}`), req.headers.get("Origin") || undefined);
}

/**
 * If your worker/index.ts expects a default export, re-export here:
 * export default { fetch: (req, env) => route(req, env) }
 * Otherwise, keep only the named export used by your worker entry.
 */

// Optional: small self-test endpoint (disabled by default)
// if (path === "/api/ping") return withCors(json({ ok: true }), req.headers.get("Origin") || undefined);
