// worker/router.ts
import { Router } from "itty-router";
import * as Auth from "./handlers/auth";
import * as Chat from "./handlers/chat";
import * as Notify from "./handlers/notify";
import { clearDownloadEmailCookie, setDownloadEmailCookie } from "./handlers/email";

type H = (req: Request, env: any, ctx: ExecutionContext) => Promise<Response> | Response;

const pick = (mod: any, names: string[]): H => {
  for (const n of names) {
    if (typeof mod?.[n] === "function") {
      try { console.log(`[router] picked Chat handler: ${n}`); } catch {}
      return mod[n] as H;
    }
  }
  if (typeof mod?.default === "function") {
    try { console.log(`[router] picked Chat handler: default`); } catch {}
    return mod.default as H;
  }
  try { console.log(`[router] no Chat handler export matched`); } catch {}
  return () =>
    new Response(JSON.stringify({ ok: false, error: "handler not found" }), {
      status: 501,
      headers: { "content-type": "application/json" },
    });
};

const trace = (name: string, h: H): H => async (req, env, ctx) => {
  const t0 = Date.now();
  const path = new URL(req.url).pathname;
  console.log(`➡️ ${name} ${req.method} ${path}`);
  try {
    const res = await h(req, env, ctx);
    console.log(`⬅️ ${name} ${res.status} ${Date.now() - t0}ms`);
    return res;
  } catch (e: any) {
    console.error(`💥 ${name}`, e?.message || e, e?.stack?.slice?.(0, 800));
    return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

// Add CORS without touching handlers
const ALLOWED_ORIGINS = new Set([
  "https://www.chrisbrighouse.com",
  "https://chrisbrighouse.com",
]);
const withCORS = (req: Request, res: Response): Response => {
  const origin = req.headers.get("Origin") || "";
  const headers = new Headers(res.headers);
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(res.body, { status: res.status, headers });
};

const preflight: H = async (req) => {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type, authorization, accept, x-diag-skip-auth",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return new Response(null, { status: 204, headers });
};

const router = Router();

// Preflight
router.options("/api/auth/*", preflight);
router.options("/api/chat/*", preflight);
router.options("/api/email/*", preflight);
router.options("/api/notify/*", preflight);
router.options("/api/download-notify", preflight);

// ---------- AUTH ----------
router.post(
  "/api/auth/login",
  trace("auth.login", async (req, env, ctx) => {
    // diagnostic bypass to prove route wiring (does NOT alter auth.ts)
    if (req.headers.get("x-diag-skip-auth") === "1") {
      return withCORS(
        req,
        new Response(JSON.stringify({ ok: true, diag: "auth route reachable" }), {
          headers: { "content-type": "application/json" },
        })
      );
    }
    const res = await Auth.login({ req, env });
    return withCORS(req, res);
  })
);

// NEW: explicit /api/auth/me route (your UI calls this)
router.get(
  "/api/auth/me",
  trace("auth.me", async (req, env, ctx) => {
    const res = await Auth.me({ req, env });
    return withCORS(req, res);
  })
);

// Quick ping
router.post(
  "/api/auth/ping",
  trace("auth.ping", async () =>
    new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
      headers: { "content-type": "application/json" },
    })
  )
);

// Logout
router.post(
  "/api/auth/logout",
  trace("auth.logout", async (req, env, ctx) => withCORS(req, await Auth.logout({ req, env })))
);

// Back-compat aliases (/api/login, /api/me, /api/logout)
router.post(
  "/api/login",
  trace("auth.login.alias", async (req, env, ctx) => withCORS(req, await Auth.login({ req, env })))
);
router.get(
  "/api/me",
  trace("auth.me.alias", async (req, env, ctx) => withCORS(req, await Auth.me({ req, env })))
);
router.post(
  "/api/logout",
  trace("auth.logout.alias", async (req, env, ctx) => withCORS(req, await Auth.logout({ req, env })))
);

// ---------- CHAT (uses your existing Cloudflare AI Gateway code) ----------
const chatStream = pick(Chat, ["handleChatStream", "handleChat", "stream", "chatStream", "chatStreamHandler"]);
// Allow both GET (for ?ping and ?test=sse diagnostics) and POST (normal chat)
router.get(
  "/api/chat/stream",
  trace("chat.stream.get", async (req, env, ctx) => withCORS(req, await chatStream(req, env, ctx)))
);
router.post(
  "/api/chat/stream",
  trace("chat.stream", async (req, env, ctx) => withCORS(req, await chatStream(req, env, ctx)))
);
// Alias for any old path variants
router.post(
  "/ai/chat/stream",
  trace("chat.stream.alias", async (req, env, ctx) => withCORS(req, await chatStream(req, env, ctx)))
);

// Known-good echo stream to validate plumbing (no Gateway)
router.post(
  "/api/chat/echo-stream",
  trace("chat.echo", async () => {
    const { readable, writable } = new TransformStream();
    const w = writable.getWriter();
    (async () => {
      try {
        for (let i = 1; i <= 5; i++) {
          await w.write(new TextEncoder().encode(`data: chunk ${i}\n\n`));
          await new Promise((r) => setTimeout(r, 250));
        }
      } finally {
        await w.close();
      }
    })();
    return withCORS(
      req,
      new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "Connection": "keep-alive",
        },
      })
    );
  })
);

// ---------- NOTIFY ----------
const notifyDownload = pick(Notify, ["handleDownloadNotify", "notify", "download", "notifyDownload"]);
router.post(
  "/api/notify/download",
  trace("notify.download", async (req, env, ctx) => withCORS(req, await notifyDownload(req, env, ctx)))
);
// Alias for legacy/default client endpoint name
router.post(
  "/api/download-notify",
  trace("notify.download.alias", async (req, env, ctx) => withCORS(req, await notifyDownload(req, env, ctx)))
);

// ---------- EMAIL (downloads cookie) ----------
router.post(
  "/api/email/set",
  trace("email.set", async (req) => withCORS(req, await setDownloadEmailCookie(req)))
);
router.post(
  "/api/email/clear",
  trace("email.clear", async (req) => withCORS(req, clearDownloadEmailCookie()))
);

// 404 fallback
router.all(
  "*",
  trace("notfound", async () => new Response("Not Found", { status: 404 }))
);

export { router };
export default router;

