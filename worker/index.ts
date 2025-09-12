// worker/index.ts
// Note: avoid calling functions before imports are loaded to prevent init-time errors.

//import { handleApi } from "./router";

// Preserve your existing imports/exports:
export { DownloadLog } from "./do/DownloadLog";

// Add these:
import * as auth from "./handlers/auth";
import * as chat from "./handlers/chat";
import * as notify from "./handlers/notify";
import { setDownloadEmailCookie, clearDownloadEmailCookie } from "./handlers/email";
import { handleHealth } from "./handlers/health";
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
  DOWNLOAD_LOG?: DurableObjectNamespace; // Durable Object for download events
}

function wantsHtml(req: Request) {
  const accept = req.headers.get("Accept") || "";
  return req.method === "GET" && accept.includes("text/html");
}





export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---- 1) API routes (explicit handlers)
    if (pathname.startsWith("/api/")) {
      // CORS preflight for API
      if (request.method === "OPTIONS") {
        const origin = request.headers.get("Origin") || "";
        const allowed = new Set(["https://www.chrisbrighouse.com", "https://chrisbrighouse.com"]);
        const headers: Record<string, string> = {
          "Access-Control-Allow-Headers": "content-type, authorization, accept, x-diag-skip-auth",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Max-Age": "600",
        };
        if (origin && allowed.has(origin)) {
          headers["Access-Control-Allow-Origin"] = origin;
          headers["Access-Control-Allow-Credentials"] = "true";
          headers["Vary"] = "Origin";
        }
        return new Response(null, { status: 204, headers });
      }
      // Lightweight health check (mobile reachability test)
      if (pathname === "/api/health" && request.method === "GET") {
        return handleHealth();
      }
      // TEMP: Early return to prove routing and prevent hangs while diagnosing
      if (pathname === "/api/auth/ping") {
        return new Response(
          JSON.stringify({ ok: true, ts: Date.now() }),
          { headers: { "content-type": "application/json" } }
        );
      }
      // TEMP: Diagnostic bypass for login wiring (no auth logic)
      if (
        pathname === "/api/auth/login" &&
        request.headers.get("x-diag-skip-auth") === "1"
      ) {
        return new Response(
          JSON.stringify({ ok: true, diag: "auth route reachable" }),
          { headers: { "content-type": "application/json" } }
        );
      }

      // TEMP: Directly handle real login to isolate router/CORS issues
      if (pathname === "/api/auth/login" && request.method === "POST") {
        return await auth.login({ req: request, env });
      }

      // TEMP: Directly handle auth me/logout endpoints (bypass router)
      if (pathname === "/api/auth/me" && request.method === "GET") {
        return await auth.me({ req: request, env });
      }
      if (pathname === "/api/auth/logout" && request.method === "POST") {
        return await auth.logout({ req: request, env });
      }

      // TEMP: Back-compat aliases
      if (pathname === "/api/login" && request.method === "POST") {
        return await auth.login({ req: request, env });
      }
      if (pathname === "/api/logout" && request.method === "POST") {
        return await auth.logout({ req: request, env });
      }
      // TEMP: Back-compat /api/me served directly
      if (pathname === "/api/me" && request.method === "GET") {
        const baseRes = await auth.me({ req: request, env });
        const status = baseRes.status;
        let payload: any = { authenticated: status === 200 };
        try {
          const j = await baseRes.clone().json();
          if (j && typeof j === "object" && (j as any).user) {
            payload.user = (j as any).user;
          }
        } catch {}
        return new Response(JSON.stringify(payload), {
          status,
          headers: { "content-type": "application/json" },
        });
      }

      // Chat stream (both GET diagnostics and POST chat)
      if (pathname === "/api/chat/stream" && (request.method === "GET" || request.method === "POST")) {
        return await chat.handleChat(request, env as any, ctx);
      }
      if (pathname === "/ai/chat/stream" && request.method === "POST") {
        return await chat.handleChat(request, env as any, ctx);
      }

      // Notify download
      if (pathname === "/api/notify/download" && request.method === "POST") {
        return await notify.handleDownloadNotify(request, env as any);
      }
      if (pathname === "/api/download-notify" && request.method === "POST") {
        return await notify.handleDownloadNotify(request, env as any);
      }

      // Admin: list download logs from Durable Object (requires auth)
      if (pathname === "/api/admin/downloads" && request.method === "GET") {
        try {
          // Auth gate: reuse the existing handler to validate the session
          const authRes = await auth.me({ req: request, env });
          if (authRes.status !== 200) return authRes; // 401/500 passthrough

          if (!env.DOWNLOAD_LOG) {
            return new Response(JSON.stringify({ ok: false, error: "storage unavailable" }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }

          // Proxy to DO export.json and normalize the shape
          const src = new URL(request.url);
          const doUrl = new URL("https://do.local/export.json");
          const limit = Number(src.searchParams.get("limit") || "100") | 0;
          if (limit) doUrl.searchParams.set("limit", String(Math.min(1000, Math.max(1, limit))));
          const from = src.searchParams.get("from");
          const to = src.searchParams.get("to");
          if (from) doUrl.searchParams.set("from", from);
          if (to) doUrl.searchParams.set("to", to);

          const id = env.DOWNLOAD_LOG.idFromName("global-downloads");
          const stub = env.DOWNLOAD_LOG.get(id);
          const doRes = await stub.fetch(doUrl.toString(), { method: "GET" });
          if (!doRes.ok) {
            const text = await doRes.text().catch(() => "");
            return new Response(JSON.stringify({ ok: false, error: "export failed", status: doRes.status, body: text.slice(0, 200) }), {
              status: 502,
              headers: { "content-type": "application/json" },
            });
          }
          const j = await doRes.json().catch(() => ({ ok: false }));
          const rows = Array.isArray(j?.rows) ? j.rows : [];
          const items = rows.map((r: any) => ({
            ts: new Date(Number(r.ts || 0)).toISOString(),
            email: String(r.email || ""),
            file: String(r.path || r.title || ""),
          }));
          return new Response(JSON.stringify({ items }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message || "admin export failed" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      // Email cookie set/clear
      if (pathname === "/api/email/set" && request.method === "POST") {
        return await setDownloadEmailCookie(request);
      }
      if (pathname === "/api/email/clear" && request.method === "POST") {
        return clearDownloadEmailCookie();
      }

      // Unknown API route
      return new Response("Not Found", { status: 404 });
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
