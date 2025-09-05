// /worker/index.ts
import { clearDownloadEmailCookie } from './handlers/email';
import { handleDownloadNotify } from './handlers/notify';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://chrisbrighouse.com',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'X-App-Handler': 'worker',
  } as const;
}

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  const c = corsHeaders();
  Object.entries(c).forEach(([k, v]) => headers.set(k, v));
  return new Response(JSON.stringify(body), { ...init, headers });
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    console.log('[🐛 DBG][WK] incoming', { method, path: pathname });

    try {
      // CORS preflight for all /api/*
      if (method === 'OPTIONS' && pathname.startsWith('/api/')) {
        return new Response(null, { headers: corsHeaders() });
      }

      // Diagnostics
      if (method === 'GET' && pathname === '/api/__whoami') {
        return json({ ok: true, stack: 'worker', ts: Date.now() });
      }
      if (method === 'GET' && pathname === '/api/debug-config') {
        return json({ ok: true, handler: 'worker', now: new Date().toISOString() });
      }

      // Clear cookie
      if (method === 'POST' && pathname === '/api/email/clear') {
        return clearDownloadEmailCookie();
      }

      // Download notify (email send + extra debug)
      if (method === 'POST' && pathname === '/api/download-notify') {
        return handleDownloadNotify(request, env);
      }

      // 404 fallback
      return json({ ok: false, error: `No route for ${pathname}` }, { status: 404 });
    } catch (err: any) {
      console.error('[🐛 DBG][WK] error', err?.stack || err?.message || String(err));
      return json({ ok: false, error: 'Internal error' }, { status: 500 });
    }
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