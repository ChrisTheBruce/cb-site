// worker/index.ts
import { handleApi } from "./router";
import { DBG } from "./env";

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      try {
        DBG("index: request", JSON.stringify({ method: request.method, path: url.pathname }));
      } catch {}

      // Gate: only handle /api/* here; all other routes pass through to Pages/origin
      if (!url.pathname.startsWith("/api/")) {
        try { DBG("index: passthrough to origin", url.pathname); } catch {}
        return await fetch(request);
      }

      // API path -> hand off to router
      try { DBG("index: dispatch -> handleApi", url.pathname); } catch {}
      return await handleApi(request, env, ctx);
    } catch (err: any) {
      // Final failsafe: never take the site down
      try { DBG("index: fatal", String(err?.message || err)); } catch {}
      try {
        return await fetch(request);
      } catch {
        return new Response("Service temporarily unavailable", { status: 503 });
      }
    }
  },
};
