// worker/router.ts

import { chat } from "./handlers/chat";

type Env = {
  OPENAI_API: string;
  OPENAI_BASE?: string;
};

type Handler = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;

type Route = {
  method: string;
  path: string; // exact match for simplicity
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

function okText(text = "") {
  return new Response(text, {
    status: 200,
    headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isApi(pathname: string) {
  return pathname.startsWith("/api/");
}

// --- Dynamic module invoker so we don't depend on exact export names ---
async function callModule(
  modPath: string,
  candidates: string[],
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const mod: Record<string, unknown> = await import(modPath);
  for (const name of candidates) {
    const fn = mod[name];
    if (typeof fn === "function") {
      return (fn as Handler)(req, env, ctx);
    }
  }
  // try default export last
  if (typeof mod.default === "function") {
    return (mod.default as Handler)(req, env, ctx);
  }
  return json(501, { error: `No callable export found in ${modPath}` });
}

// Build the route table
const routes: Route[] = [
  // New streaming chat endpoint (OpenAI via Cloudflare AI Gateway)
  { method: "POST", path: "/api/chat", handler: chat as Handler },

  // Health check (GET)
  {
    method: "GET",
    path: "/api/health",
    handler: (req, env, ctx) =>
      callModule("./handlers/health", ["health", "handleHealth", "handle", "get"], req, env, ctx),
  },

  // Email/notify endpoints (POST)
  {
    method: "POST",
    path: "/api/notify",
    handler: (req, env, ctx) =>
      callModule("./handlers/notify", ["notify", "handleNotify", "handle", "post"], req, env, ctx),
  },
  {
    method: "POST",
    path: "/api/email",
    handler: (req, env, ctx) =>
      callModule("./handlers/email", ["email", "send", "handleEmail", "handle", "post"], req, env, ctx),
  },

  // Auth endpoints (POST/GET)
  {
    method: "POST",
    path: "/api/auth/login",
    handler: (req, env, ctx) =>
      callModule("./handlers/auth", ["login", "handleLogin", "handle", "post"], req, env, ctx),
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    handler: (req, env, ctx) =>
      callModule("./handlers/auth", ["logout", "handleLogout", "handle", "post"], req, env, ctx),
  },
  {
    method: "GET",
    path: "/api/auth/me",
    handler: (req, env, ctx) =>
      callModule("./handlers/auth", ["me", "profile", "handleMe", "handle", "get"], req, env, ctx),
  },
];

// Match by exact method+path (keeps things predictable)
function findRoute(method: string, pathname: string): Route | undefined {
  return routes.find((r) => r.method === method && r.path === pathname);
}

// Default export: fetch-style handler used by worker/index.ts
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Preflight for any /api/* path
    if (req.method === "OPTIONS" && isApi(url.pathname)) {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Only handle /api/* here; let your worker/index.ts serve assets, etc.
    if (isApi(url.pathname)) {
      const route = findRoute(req.method, url.pathname);
      if (!route) return json(404, { error: "Not found" });

      try {
        const res = await route.handler(req, env, ctx);
        // Add CORS headers if missing for API responses
        const withCors = new Headers(res.headers);
        Object.entries(CORS).forEach(([k, v]) => {
          if (!withCors.has(k)) withCors.set(k, v);
        });
        return new Response(res.body, { status: res.status, headers: withCors });
      } catch (err) {
        return json(500, { error: "Unhandled exception", detail: String(err) });
      }
    }

    // Not an API route; your worker/index.ts should handle this (assets, SPA fallback)
    return new Response(null, { status: 404 });
  },
};
