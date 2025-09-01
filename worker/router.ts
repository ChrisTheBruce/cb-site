// worker/router.ts
// Lightweight API router. Returns `Response | null` so the caller can
// fall through to static asset serving when we don't handle a route.

import { setEmailHandler, clearEmailHandler } from "./handlers/email";

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

  // Add more API routes here (examples):
  // if (request.method === "POST" && pathname === "/api/notify_download") {
  //   return notifyDownloadHandler(request, env); // if you implement notify handler
  // }
  // if (request.method === "GET" && pathname === "/api/health") {
  //   return new Response(JSON.stringify({ ok: true }), {
  //     headers: { "content-type": "application/json; charset=utf-8" },
  //   });
  // }

  // Not handled by API router; let caller serve static/app.
  return null;
}

// For convenience, some codebases import a default:
export default route;
