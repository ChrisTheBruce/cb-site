// worker/router.ts
import { chatStreamOpenAI } from "./handlers/chat";
import { setEmailHandler, clearEmailHandler } from "./handlers/email";
import { loginHandler, logoutHandler, meHandler } from "./handlers/auth";

export interface Env {
  OPENAI_API?: string;
  ASSETS: { fetch(req: Request): Promise<Response> };
}

export async function route(request: Request, env: Env): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();

  // Chat: OpenAI only
  if (method === "POST" && pathname === "/api/chat/stream") {
    const res = await chatStreamOpenAI(request, env);
    const h = new Headers(res.headers);
    h.set("X-Chat-Handler", "openai"); // prove it's the OpenAI path
    return new Response(res.body, { status: res.status, headers: h });
  }

  // Email (downloads)
  if (method === "POST" && pathname === "/api/email") return setEmailHandler(request);
  if (method === "POST" && pathname === "/api/email/clear") return clearEmailHandler(request);

  // Auth
  if (method === "POST" && pathname === "/api/login") return loginHandler(request);
  if (method === "POST" && pathname === "/api/logout") return logoutHandler(request);
  if (method === "GET" && pathname === "/api/me") return meHandler(request);

  return null; // let static assets handle the rest
}
