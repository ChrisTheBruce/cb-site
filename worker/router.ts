// worker/router.ts
import { chatStreamOpenAI } from "./handlers/chat";
// If you have these handlers, keep the imports; otherwise remove the lines.
import { setEmailHandler, clearEmailHandler } from "./handlers/email";
import { loginHandler, logoutHandler, meHandler } from "./handlers/auth";

export interface Env {
  OPENAI_API?: string;
  ASSETS: { fetch(req: Request): Promise<Response> };
}

// Primary API router used by worker/index.ts
export async function handleApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  // --- Chat: OpenAI streaming only ---
  if (method === "POST" && pathname === "/api/chat/stream") {
    const res = await chatStreamOpenAI(request, env);
    const headers = new Headers(res.headers);
    headers.set("X-Chat-Handler", "openai");
    return new Response(res.body, { status: res.status, headers });
  }

  // --- Email (downloads) ---
  if (method === "POST" && pathname === "/api/email") return setEmailHandler(request);
  if (method === "POST" && pathname === "/api/email/clear") return clearEmailHandler(request);

  // --- Auth ---
  if (method === "POST" && pathname === "/api/login") return loginHandler(request);
  if (method === "POST" && pathname === "/api/logout") return logoutHandler(request);
  if (method === "GET" && pathname === "/api/me") return meHandler(request);

  // Not an API route: let static assets handle it
  return null;
}

// Back-compat alias (if any other file imports `route`)
export const route = handleApi;
