// worker/router.ts
// Returns `Response | null` so the caller can fall through to static file serving.

import { setEmailHandler, clearEmailHandler } from "./handlers/email";
import { loginHandler, logoutHandler, meHandler } from "./handlers/auth";
import { chatStreamEcho } from "./handlers/chat"; // NEW: Stage 1 streaming echo

export async function route(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method.toUpperCase();

  // ---- Chat (Stage 1: streaming echo, no OpenAI) ----
  // Keep this very early so it can't be shadowed by other /api/* matches.
  if (method === "POST" && pathname === "/api/chat/stream") {
    return chatStreamEcho(request);
  }

  // ---- Email (downloads) ----
  if (method === "POST" && pathname === "/api/email") {
    return setEmailHandler(request);
  }
  if (method === "POST" && pathname === "/api/email/clear") {
    return clearEmailHandler(request);
  }

  // ---- Auth (login/logout/me) ----
  if (method === "POST" && pathname === "/api/login") {
    return loginHandler(request);
  }
  if (method === "POST" && pathname === "/api/logout") {
    return logoutHandler(request);
  }
  if (method === "GET" && pathname === "/api/me") {
    return meHandler(request);
  }

  // Not handled -> let outer layer serve static app assets.
  return null;
}

// Back-compat alias for your existing worker/index.ts import
export async function handleApi(
  request: Request,
  _env?: unknown,
  _ctx?: ExecutionContext
): Promise<Response | null> {
  return route(request);
}

export default route;
