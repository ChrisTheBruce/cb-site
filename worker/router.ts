// worker/router.ts
import { Router } from "itty-router";
import * as Auth from "./handlers/auth";
import * as Chat from "./handlers/chat";
import * as Notify from "./handlers/notify";

type H = (req: Request, env: any, ctx: ExecutionContext) => Promise<Response> | Response;

const pick = (mod: any, names: string[]): H => {
  for (const n of names) if (typeof mod?.[n] === "function") return mod[n] as H;
  if (typeof mod?.default === "function") return mod.default as H;
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
const withCORS = (res: Response): Response => {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "https://www.chrisbrighouse.com");
  headers.append("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers });
};

const preflight: H = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://www.chrisbrighouse.com",
      "Access-Control-Allow-Headers": "content-type, authorization, x-diag-skip-auth",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "600",
    },
  });

const router = Router();

// Preflight
router.options("/api/auth/*", preflight);
router.options("/api/chat/*", preflight);

// ---------- AUTH ----------
router.post(
  "/api/auth/login",
  trace("auth.login", async (req, env, ctx) => {
    // diagnostic bypass to prove route wiring (does NOT alter auth.ts)
    if (req.headers.get("x-diag-skip-auth") === "1") {
      return withCORS(
        new Response(JSON.stringify({ ok: true, diag: "auth route reachable" }), {
          headers: { "content-type": "application/json" },
        })
      );
    }
    const res = await Auth.login({ req, env });
    return withCORS(res);
  })
);

// NEW: explicit /api/auth/me route (your UI calls this)
router.get(
  "/api/auth/me",
  trace("auth.me", async (req, env, ctx) => {
    const res = await Auth.me({ req, env });
    return withCORS(res);
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

// ---------- CHAT (uses your existing Cloudflare AI Gateway code) ----------
const chatStream = pick(Chat, ["stream", "chatStream", "chatStreamHandler"]);
router.post(
  "/api/chat/stream",
  trace("chat.stream", async (req, env, ctx) => withCORS(await chatStream(req, env, ctx)))
);
// Alias for any old path variants
router.post(
  "/ai/chat/stream",
  trace("chat.stream.alias", async (req, env, ctx) => withCORS(await chatStream(req, env, ctx)))
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
const notifyDownload = pick(Notify, ["notify", "download", "notifyDownload"]);
router.post("/api/notify/download", trace("notify.download", notifyDownload));

// 404 fallback
router.all(
  "*",
  trace("notfound", async () => new Response("Not Found", { status: 404 }))
);

export { router };
export default router;
