// worker/index.ts
DBG("worker/index.ts Debug mode on");
console.log ("worker/index.ts top of file");

//import { handleApi } from "./router";

// Preserve your existing imports/exports:
import { clearDownloadEmailCookie } from "./handlers/email";
export { DownloadLog } from "./do/DownloadLog";

// Add these:
import { router } from "./router";
import * as auth from "./handlers/auth";
import { DBG } from "./env";
import type { Fetcher } from "@cloudflare/workers-types";

/*
export interface Env {
  // Adjust typings to your bindings as needed:
   ASSETS?: Fetcher;
  // DOWNLOADS_DO?: DurableObjectNamespace;
  // SESSION_SECRET?: string;
}
*/

export interface Env {
  OPENAI_API?: string;
  OPENAI_BASE_URL?: string;
  DEBUG_MODE?: string;
  ASSETS?: Fetcher;   // optional
}

function wantsHtml(req: Request) {
  const accept = req.headers.get("Accept") || "";
  return req.method === "GET" && accept.includes("text/html");
}





export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---- 1) API routes → itty-router
    if (pathname.startsWith("/api/")) {
      try {
        DBG("index.ts: router for API", { method: request.method, path: pathname });
        return await router.handle(request, env, ctx);
      } catch (err) {
        console.error("💥 router.handle threw:", err);
        return new Response(JSON.stringify({ ok: false, error: "Router error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // ---- 2) Gate downloads on email cookie
    if (pathname.startsWith("/downloads/")) {
      const cookie = request.headers.get("Cookie") || "";
      const hasAllowed = /(?:^|;\s*)(download_email|cb_dl_email|DL_EMAIL)=/.test(cookie);
      if (!hasAllowed) {
        const html = `<!doctype html>\n<html>\n  <head><meta charset=\"utf-8\"><title>Download requires email</title></head>\n  <body style=\"font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px;\">\n    <h1 style=\"margin:0 0 8px;\">Email required</h1>\n    <p>Go back to the downloads page and click the link again; you'll be prompted for your email.</p>\n    <p><a href=\"/\" style=\"color:#1f6feb;text-decoration:none;\">Return to site</a></p>\n  </body>\n</html>`;
        return new Response(html, { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    }

    // ---- 3) Static assets + SPA fallback
    if (env.ASSETS) {
      // Try exact asset
      let res = await env.ASSETS.fetch(request);
      if (res.status !== 404) return res;

      // React Router client routes: serve index.html
      if (wantsHtml(request)) {
        const indexUrl = new URL("/index.html", url.origin);
        const indexReq = new Request(indexUrl.toString(), request);
        res = await env.ASSETS.fetch(indexReq);
        if (res.status !== 404) return res;
      }

      // propagate 404 from assets
      return res;
    }

    return new Response("Not Found", { status: 404 });
  },
};



/*
import type { Env } from "./router";
import { handleApi } from "./router";
import { rid, log } from "./lib/ids";
import { bad } from "./lib/responses";
import { DBG, isDebug } from './env'; 

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const ridStr = rid();
    const url = new URL(request.url);
    
    console.log("DEBUG_MODE:", env.DEBUG_MODE);
    console.log("typeof DEBUG_MODE:", typeof env.DEBUG_MODE);
    
    if (env.DEBUG_MODE === "true") {
      console.log("⚙️  Debug mode enabled ✅");
    } else {
      console.log("❌ Debug mode NOT enabled");
    }

    try {
      // --- CORS preflight for API calls (existing behavior) ---
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": url.origin,
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400",
          },
        });
      }
      
      // Debug checking
      if (isDebug(env)) {
      console.log('⚙️  Debug mode enabled by isDebug(env)');
      }
      DBG("also from DBG function");

      // --- NEW: Stage 1 streaming stub (no OpenAI yet) ---
      // Intercept only POST /api/chat/stream and stream an echo of the last user message.
      if (request.method === "POST" && url.pathname === "/api/chat/stream") {
        try {
          const { messages = [] } = await request.json();
          const lastUser =
            [...messages]
              .reverse()
              .find((m: any) => m && m.role === "user")?.content ?? "";

          const encoder = new TextEncoder();
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              const prefix = "Echo: ";
              // Split to simulate token-by-token streaming
              const tokens = (prefix + (lastUser || "(no input)")).split(/\s+/);
              for (const t of tokens) {
                controller.enqueue(encoder.encode(t + " "));
                // tiny delay so you can see streaming in curl/UI
                await new Promise((r) => setTimeout(r, 35));
              }
              controller.close();
            },
          });

          const res = new Response(stream, {
            status: 200,
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "no-store",
              "access-control-allow-origin": url.origin,
              // Note: we keep this plain text stream for Stage 1. We'll keep the same endpoint
              // and swap the source to OpenAI in Stage 3 without changing the frontend.
            },
          });
          res.headers.set("x-request-id", ridStr);
          return res;
        } catch (err: any) {
          log("warn", ridStr, "chat/stream bad request", { error: err?.message ?? String(err) });
          const res = bad(400, "Bad request", ridStr);
          res.headers.set("access-control-allow-origin", url.origin);
          return res;
        }
      }
      // --- /NEW ---

      // Existing API routing
      if (url.pathname.startsWith("/api/")) {
        const res = await handleApi(request, env, ridStr);
        res.headers.set("x-request-id", ridStr);
        res.headers.set("cache-control", "no-store");
        return res;
      }

      // Static assets (existing)
      const assetRes = await env.ASSETS.fetch(request);
      assetRes.headers.set("x-request-id", ridStr);
      return assetRes;
    } catch (err: any) {
      log("error", ridStr, "Unhandled exception", { error: err?.message || String(err) });
      return bad(500, "Internal error", ridStr);
    } finally {
      log("info", ridStr, "request", {
        method: request.method,
        path: url.pathname,
        ip: request.headers.get("cf-connecting-ip") || "",
        ua: request.headers.get("user-agent") || "",
      });
    }
  },
};

*/
