// worker/router.ts
// Returns `Response | null` so the caller can fall through to static file serving.

import { setEmailHandler, clearEmailHandler } from "./handlers/email";
import { loginHandler, logoutHandler, meHandler } from "./handlers/auth";

export async function route(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;

  // ---- Email (downloads) ----
  if (request.method === "POST" && pathname === "/api/email") {
    return setEmailHandler(request);
  }
  if (request.method === "POST" && pathname === "/api/email/clear") {
    return clearEmailHandler(request);
  }

  // ---- Auth ----
  if (pathname === "/api/login" && request.method === "POST") {
    return loginHandler(request);
  }
  if (pathname === "/api/logout" && request.method === "POST") {
    return logoutHandler(request);
  }
  if (pathname === "/api/me" && request.method === "GET") {
    return meHandler(request);
  }

  // Add additional API routes here (e.g., notify_download) if needed.

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
