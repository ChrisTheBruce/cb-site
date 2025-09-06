// worker/index.ts

// ✅ Keep your existing direct import (you had this already)
import { clearDownloadEmailCookie } from "./handlers/email";

// ✅ Re-export your Durable Object class so CF can instantiate it.
//    This must match the class_name in wrangler.jsonc.
export { DownloadLog } from "./do/DownloadLog";

import { router } from "./router";

export interface Env {
  // If you serve the built app from /dist via Cloudflare assets:
  // wrangler.jsonc → { "assets": { "directory": "dist", "binding": "ASSETS" } }
  ASSETS?: Fetcher;

  // Add your other bindings here if you like (KV, DO namespaces, secrets, etc.)
  // DOWNLOADS_DO?: DurableObjectNamespace;
  // SESSION_SECRET?: string;
}

function wantsHtml(req: Request) {
  const accept = req.headers.get("Accept") || "";
  return req.method === "GET" && accept.includes("text/html");
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // 🔹 0) Back-compat: honor your existing direct handler for /api/email/clear
    //     (kept so nothing regresses, even though router also wires this path)
    if (pathname === "/api/email/clear" && request.method === "POST") {
      try {
        // Signature matches your previous code: (request, env) -> Response
        return await clearDownloadEmailCookie(request as any, env as any);
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
    }

    // 🔹 1) Route ALL remaining /api/* traffic through itty-router FIRST
    //     This is the key part that fixes "No route for /api/auth/login".
    if (pathname.startsWith("/api/")) {
      try {
        return await router.handle(request, env, ctx);
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
    }

    // 🔹 2) Static assets via ASSETS binding (unchanged behaviour)
    if (env.ASSETS) {
      // Try exact asset
      let res = await env.ASSETS.fetch(request);
      if (res.status !== 404) return res;

      // SPA fallback for client-routed pages (React Router)
      if (wantsHtml(request)) {
        const indexUrl = new URL("/index.html", url.origin);
        const indexReq = new Request(indexUrl.toString(), request);
        res = await env.ASSETS.fetch(indexReq);
        if (res.status !== 404) return res;
      }

      // Propagate asset 404
      return res;
    }

    // 🔹 3) No assets configured → minimal 404
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