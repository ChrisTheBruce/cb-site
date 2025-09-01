// worker/router.ts
import type { Env } from "./env"; // if you have an Env type; otherwise remove this import
import { chatStreamOpenAI } from "./handlers/chat"; // <- OpenAI handler ONLY
import { setEmailHandler, clearEmailHandler } from "./handlers/email";
import { loginHandler, logoutHandler, meHandler } from "./handlers/auth";

export async function route(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  // --- Chat: OpenAI streaming only ---
  if (method === "POST" && pathname === "/api/chat/stream") {
    const res = await chatStreamOpenAI(request, env as any);
    // Tag the response so we can prove this handler ran
    const newHeaders = new Headers(res.headers);
    newHeaders.set("X-Chat-Handler", "openai");
    return new Response(res.body, { status: res.status, headers: newHeaders });
  }

  // --- Email (downloads) ---
  if (method === "POST" && pathname === "/api/email") return setEmailHandler(request);
  if (method === "POST" && pathname === "/api/email/clear") return clearEmailHandler(request);

  // --- Auth ---
  if (method === "POST" && pathname === "/api/login") return loginHandler(request);
  if (method === "POST" && pathname === "/api/logout") return logoutHandler(request);
  if (method === "GET" && pathname === "/api/me") return meHandler(request);

  // Not handled -> let static assets layer handle it
  return null;
}

// Back-compat if something else imports handleApi()
export async function handleApi(request: Request, env: Env): Promise<Response | null> {
  return route(request, env);
}

export default route;
