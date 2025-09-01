// worker/router.ts
// Lightweight API router. Returns `Response | null` so the caller can
// fall through to static asset serving when we don't handle a route.

import { setEmailHandler, clearEmailHandler } from "./handlers/email";
// If/when you add notify, you'd import it here:
// import { notifyDownloadHandler } from "./handlers/notify";

export async function route(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;

  // EMAIL: set / clear download email cookie
  if (request.method === "POST" && pathname === "/api/email") {
    return setEmailHandler(request);
  }
  if (request.method === "POST" && pathname === "/api/email/clear") {
    return clearEmailHandler(request);
  }

  // NOTIFY (uncomment when you add it)
  // if (request.method === "POST" && pathname === "/api/notify_download") {
  //   return notifyDownloadHandler(request, env);
  // }

  // Not handled by API router; let caller serve static/app.
  return null;
}

// --- Back-compat named export ---
// Your worker/index.ts imports { handleApi } from "./router".
// Provide it as an alias so we don't have to touch worker/index.ts.
export async function handleApi(
  request: Request,
  _env?: unknown,
  _ctx?: ExecutionContext
): Promise<Response | null> {
  return route(request);
}

// Default export for convenience
export default route;
