// worker/router.ts
import { chatStreamOpenAI } from "./handlers/chat";

export interface Env {
  OPENAI_API?: string;
  ASSETS: { fetch(req: Request): Promise<Response> };
}

export async function handleApi(request: Request, env: Env): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "POST" && pathname === "/api/chat/stream") {
    const res = await chatStreamOpenAI(request, env);
    const h = new Headers(res.headers);
    h.set("X-Chat-Handler", "openai");    // marker
    h.set("X-Worker-Service", "cb-site"); // marker
    return new Response(res.body, { status: res.status, headers: h });
  }

  return null;
}
