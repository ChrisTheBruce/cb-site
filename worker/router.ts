// worker/router.ts
// API router. Exports `handleApi` for worker/index.ts.

import { chat } from "./handlers/chat";
import * as auth from "./handlers/auth";
import * as email from "./handlers/email";
import * as notify from "./handlers/notify";
import * as health from "./handlers/health";

type Env = {
  OPENAI_API: string;
  OPENAI_BASE?: string;
};

type Handler = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;

type Route = {
  method: string;
  path: string; // exact match
  handler: Handler;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function withCors(res: Response) {
  const h = new Headers(res.headers);
  Object.entries(CORS).forEach(([k, v]) => {
    if (!h.has(k)) h.set(k, v);
  });
  return new Response(res.body, { status: res.status, headers: h });
}

function isApi(pathname: string) {
  return pathname.startsWith("/api/");
}

// Resolve a callable from a statically imported module by trying common names
function resolveExport(mod: Record<string, unknown>, names: string[]): Handler | null {
  for (const n of names) {
    const f = mod[n];
    if (typeof f === "function") return f as Handler;
  }
  const def = mod.default;
  if (typeof def === "function") return def as Handler;
  return null;
}

// Wrap call so non-Response returns are turned into JSON
async function invoke(handler: Handler, req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const result = await handler(req, env, ctx);
  if (result instanceof Response) return result;
  if (result === undefined) return new Response(null, { status: 204, headers: CORS });
  return json(200, result);
}

// ---- Route table (static imports, resilient export resolution) ----
const routes: Route[] = [
  // Streaming chat via CF AI Gateway → OpenAI
  { method: "POST", path: "/api/chat", handler: chat as Handler },

  // Health
  {
    method: "GET",
    path: "/api/health",
    handler: async (req, env, ctx) => {
      const fn = resolveExport(health as unknown as Record<string, unknown>, [
        "health",
        "handleHealth",
        "handle",
        "get",
      ]);
      if (!fn) return json(501, { error: "No callable export in handlers/health" });
      return invoke(fn, req, env, ctx);
    },
  },

  // Notifications
  {
    method: "POST",
    path: "/api/notify",
    handler: async (req, env, ctx) => {
      const fn = resolveExport(notify as unknown as Record<string, unknown>, [
        "notify",
        "handleNotify",
        "handle",
        "post",
      ]);
      if (!fn) return json(501, { error: "No callable export in handlers/notify" });
      return invoke(fn, req, env, ctx);
    },
  },

  // Email
  {
    method: "POST",
    path: "/api/email",
    handler: async (req, env, ctx) => {
      const fn = resolveExport(email as unknown as Record<string, unknown>, [
        "email",
        "send",
        "handleEmail",
        "handle",
        "post",
      ]);
      if (!fn) return json(501, { error: "No callable export in handlers/email" });
      return invoke(fn, req, env, ctx);
    },
  },

  // Auth (new paths)
  {
    method: "POST",
    path: "/api/auth/login",
    handler: async (req, env, ctx) => {
      const fn = resolveExport(auth as unknown as Record<string, unknown>, [
        "login",
        "handleLogin",
        "handle",
        "post",
      ]);
      if (!fn) return json(501, { error: "No callable export in handlers/auth (login)" });
      return invoke(fn, req, env, ctx);
    },
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    handler: async (req, env, ctx) => {
      const fn = resolveExport(auth as unknown as Record<string, unknown>, [
        "logout",
        "handleLogout",
        "handle",
        "post",
      ]);
      if (!fn) return json(501, { error: "No callable export in handlers/auth (logout)" });
      return invoke(fn, req, env, ctx);
    },
  },
  {
    method: "GET",
    path: "/api/auth/me",
    handler: async (req, env, ctx) => {
      const fn = resolveExport(auth as unknown as Record<string, unknown>, [
        "me",
        "profile",
        "handleMe",
        "handle",
        "get",
      ]);
      if (!fn) return json(501, { error: "No callable export in handlers/auth (me)" });
      return invoke(fn, req, env, ctx);
    },
  },

  // Auth (legacy aliases to avoid breaking the UI)
  {
    method: "POST",
    path: "/api/login",
    handler: async (req, env, ctx) => {
      const fn = resolveExport(auth as unknown as Record<string, unknown>, [
        "login",
        "handleLogin",
        "handle",
        "post",
      ]);
      if (!fn) return json(501, { error: "No callable export in handlers/auth (login)" });
      return invoke(fn, req, env, ctx);
    },
  },
  {
    method: "POST",
    path: "/api/logout",
    handler: async (req, env, ctx) => {
      const fn = resolveExport(auth as unknown as Record<string, unknown>, [
        "logout",
        "handleLogout",
        "handle",
        "post",
      ]);
      if (!fn) return json(501, { error: "No callable export in handlers/auth (logout)" });
      return invoke(fn, req, env, ctx);
    },
  },
  {
    method: "GET",
    path: "/api/me",
    handler: async (req, env, ctx) => {
      const fn = resolveExport(auth as unknown as Record<string, unknown>, [
        "me",
        "profile",
        "handleMe",
        "handle",
        "get",
      ]);
      if (!fn) return json(501, { error: "No callable export in handlers/auth (me)" });
      return invoke(fn, req, env, ctx);
    },
  },
];

function findRoute(method: string, pathname: string): Route | undefined {
  return routes.find((r) => r.method === method && r.path === pathname);
}

// Named export used by worker/index.ts
export async function handleApi(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);

  if (!isApi(url.pathname)) {
    return new Response("Not an API route", { status: 404 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const route = findRoute(req.method, url.pathname);
  if (!route) return json(404, { error: "Not found", path: url.pathname, method: req.method });

  try {
    const res = await route.handler(req, env, ctx);
    return withCors(res);
  } catch (err: any) {
    // Return structured error so you can see it in DevTools
    return json(500, { error: "Unhandled exception", detail: String(err?.message || err) });
  }
}
