// worker/router.ts
// Router for all /api/* endpoints. Exports `handleApi` (as expected by worker/index.ts).

import { chat } from "./handlers/chat";

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

function isApi(pathname: string) {
  return pathname.startsWith("/api/");
}

// Dynamically import a handler module and invoke the first matching export name
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
  if (typeof mod.default === "function") {
    return (mod.default as Handler)(req, env, ctx);
  }
  return json(501, { error: `No callable export found in ${modPath}` });
}

// Route table — add more here as needed
const routes: Route[] = [
  // New streaming chat endpoint via Cloudflare AI Gateway → OpenAI
  { method: "POST", path: "/api/chat", handler: chat as Handler },

  // Health
  {
    method: "GET",
    path: "/api/health",
    handler: (req, env, ctx) =>
      callModule("./handlers/health", ["health", "handleHealth", "handle", "get"], req, env, ctx),
  },

  // Notifications & email
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

  // Auth
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

function findRoute(method: string, pathname: string): Route | undefined {
  return routes.find((r) => r.method === method && r.path === pathname);
}

/**
 * Named export expected by worker/index.ts
 * Handles ONLY /api/* requests. Non-API paths should be handled elsewhere (assets, SPA).
 */
export async function handleApi(
  req: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(req.url);

  if (!isApi(url.pathname)) {
    // Not for us — let the caller handle (usually worker/index.ts serving assets)
    return new Response("Not an API route", { status: 404 });
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const route = findRoute(req.method, url.pathname);
  if (!route) return json(404, { error: "Not found" });

  try {
    const res = await route.handler(req, env, ctx);
    // Ensure CORS on API responses
    const withCors = new Headers(res.headers);
    Object.entries(CORS).forEach(([k, v]) => {
      if (!withCors.has(k)) withCors.set(k, v);
    });
    return new Response(res.body, { status: res.status, headers: withCors });
  } catch (err) {
    return json(500, { error: "Unhandled exception", detail: String(err) });
  }
}
