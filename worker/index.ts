// /worker/index.ts
import { clearDownloadEmailCookie } from "./handlers/email";
export { DownloadLog } from "./do/DownloadLog";

type Env = {
  DOWNLOAD_LOG: DurableObjectNamespace;
  EXPORT_USER?: string;
  EXPORT_PASS?: string;
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "https://chrisbrighouse.com",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true",
    "X-App-Handler": "worker"
  } as const;
}

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  Object.entries(cors()).forEach(([k, v]) => headers.set(k, v));
  return new Response(JSON.stringify(body), { ...init, headers });
}

async function forwardToDO(stub: DurableObjectStub, path: string, init?: RequestInit) {
  const url = "https://do" + path;
  const resp = await stub.fetch(url, init);
  const outHeaders = new Headers(resp.headers);
  Object.entries(cors()).forEach(([k, v]) => outHeaders.set(k, v));
  return new Response(resp.body, { status: resp.status, headers: outHeaders });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, search } = url;
    const method = request.method.toUpperCase();

    console.log("[🐛 DBG][WK] incoming", { method, path: pathname });

    try {
      if (method === "OPTIONS" && pathname.startsWith("/api/")) {
        return new Response(null, { headers: cors() });
      }

      // Diagnostics
      if (method === "GET" && pathname === "/api/__whoami") {
        return json({ ok: true, stack: "worker", ts: Date.now() });
      }
      if (method === "GET" && pathname === "/api/debug-config") {
        return json({ ok: true, handler: "worker", now: new Date().toISOString() });
      }

      // Clear cookie
      if (method === "POST" && pathname === "/api/email/clear") {
        return clearDownloadEmailCookie();
      }

      // Server-set cookie (optional, kept from earlier)
      if (method === "POST" && pathname === "/api/email/set") {
        let body: any = {};
        try { body = await request.json(); } catch {}
        const email = String(body?.email || "");
        if (!EMAIL_RE.test(email)) {
          return json({ ok: false, error: "invalid email" }, { status: 400 });
        }

        const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
        const hostOnly = [
          `download_email=${encodeURIComponent(email)}`,
          "Path=/",
          `Expires=${oneYear}`,
          "HttpOnly",
          "Secure",
          "SameSite=Lax",
        ].join("; ");
        const withDomain = [
          `download_email=${encodeURIComponent(email)}`,
          "Path=/",
          `Expires=${oneYear}`,
          "HttpOnly",
          "Secure",
          "SameSite=Lax",
          "Domain=chrisbrighouse.com",
        ].join("; ");

        const headers = new Headers(cors());
        headers.set("Content-Type", "application/json");
        headers.append("Set-Cookie", hostOnly);
        headers.append("Set-Cookie", withDomain);

        console.log("[🐛 DBG][WK] set /api/email/set → cookie set (both variants)");
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      // Durable Object stub (single global instance)
      const id = env.DOWNLOAD_LOG.idFromName("global");
      const stub = env.DOWNLOAD_LOG.get(id);

      // Append a download log
      if (method === "POST" && pathname === "/api/download-notify") {
        let body: any = {};
        try { body = await request.json(); } catch {}
        body.ts = Number.isFinite(body.ts) ? body.ts : Date.now();
        body.ua = body.ua || request.headers.get("user-agent") || "";
        body.ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
        body.referer = request.headers.get("referer") || "";

        console.log("[🐛 DBG][WK] forwarding to DO /append", { email: body.email, path: body.path });
        return await forwardToDO(stub, "/append", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }

      // Export JSON
      if (method === "GET" && pathname === "/api/downloads/export.json") {
        const auth = request.headers.get("authorization");
        console.log("[🐛 DBG][WK] forwarding to DO /export.json", { search, hasAuth: !!auth });
        return await forwardToDO(
          stub,
          "/export.json" + search,
          { headers: auth ? { "Authorization": auth } : undefined }
        );
      }

      // Export CSV
      if (method === "GET" && pathname === "/api/downloads/export.csv") {
        const auth = request.headers.get("authorization");
        console.log("[🐛 DBG][WK] forwarding to DO /export.csv", { search, hasAuth: !!auth });
        return await forwardToDO(
          stub,
          "/export.csv" + search,
          { headers: auth ? { "Authorization": auth } : undefined }
        );
      }

      return json({ ok: false, error: `No route for ${pathname}` }, { status: 404 });
    } catch (err: any) {
      console.error("[🐛 DBG][WK] error", err?.stack || err?.message || String(err));
      return json({ ok: false, error: "Internal error" }, { status: 500 });
    }
  }
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