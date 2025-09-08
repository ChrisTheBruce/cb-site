// worker/router.ts
import { Router } from "itty-router";

// Import your existing handlers without touching them
// (adjust paths if your tree differs)
import * as Auth from "./handlers/auth";
import * as Chat from "./handlers/chat";
import * as Notify from "./handlers/notify";

// ---- helpers ----
type H = (req: Request, env: any, ctx: ExecutionContext) => Promise<Response> | Response;
const pick = (mod: any, names: string[]): H => {
  for (const n of names) if (typeof mod?.[n] === "function") return mod[n] as H;
  if (typeof mod?.default === "function") return mod.default as H;
  // fallback: fast 501 so we never hang
  return () => new Response(JSON.stringify({ ok: false, error: "handler not found" }), {
    status: 501, headers: { "content-type": "application/json" }
  });
};
const trace = (name: string, h: H): H => async (req, env, ctx) => {
  const t0 = Date.now();
  const { method } = req; const path = new URL(req.url).pathname;
  console.log(`➡️ ${name} ${method} ${path}`);
  try {
    const res = await h(req, env, ctx);
    console.log(`⬅️ ${name} ${res.status} ${Date.now() - t0}ms`);
    return res;
  } catch (e: any) {
    console.error(`💥 ${name}`, e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: "Internal error" }), {
      status: 500, headers: { "content-type": "application/json" }
    });
  }
};
const withCORS = (res: Response): Response =>
  new Response(res.body, {
    status: res.status,
    statusText: (res as any).statusText,
    headers: (() => {
      const h = new Headers(res.headers);
      h.set("Access-Control-Allow-Origin", "https://www.chrisbrighouse.com");
      h.append("Vary", "Origin");
      return h;
    })()
  });

// ---- router ----
const router = Router();

// Preflight for api/chat + api/auth (prevents browser stalling on OPTIONS)
const preflight: H = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://www.chrisbrighouse.com",
      "Access-Control-Allow-Headers": "content-type, authorization, x-diag-skip-auth",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "600"
    }
  });
router.options("/api/auth/*", preflight);
router.options("/api/chat/*", preflight);

// ----- AUTH -----
const authLogin = pick(Auth, ["login", "authLogin", "authLoginHandler", "handleLogin"]);
router.post(
  "/api/auth/login",
  trace("auth.login", async (req, env, ctx) => {
    // diagnostic bypass to prove the route wiring returns (does NOT touch auth.ts)
    if (req.headers.get("x-diag-skip-auth") === "1") {
      return withCORS(new Response(JSON.stringify({ ok: true, diag: "auth route reachable" }), {
        headers: { "content-type": "application/json" }
      }));
    }
    const res = await authLogin(req, env, ctx);
    return withCORS(res);
  })
);

// Helpful quick check
router.post("/api/auth/ping", trace("auth.ping", async () =>
  new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    headers: { "content-type": "application/json" }
  })
));

// ----- CHAT (Cloudflare AI Gateway lives inside your handler; we don’t change it) -----
const chatStream = pick(Chat, ["stream", "chatStream", "chatStreamHandler"]);
router.post("/api/chat/stream", trace("chat.stream", async (req, env, ctx) => {
  const res = await chatStream(req, env, ctx);
  // CORS for SSE
  return withCORS(res);
}));

// Alias in case the UI hits /ai/chat/stream
router.post("/ai/chat/stream", trace("chat.stream.alias", async (req, env, ctx) => {
  const res = await chatStream(req, env, ctx);
  return withCORS(res);
}));

// Known-good echo stream to validate your streaming plumbing (no Gateway involved)
router.post("/api/chat/echo-stream", trace("chat.echo", async () => {
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
  return withCORS(new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "Connection": "keep-alive"
    }
  }));
}));

// ----- NOTIFY (kept as-is) -----
const notifyDownload = pick(Notify, ["notify", "download", "notifyDownload"]);
router.post("/api/notify/download", trace("notify.download", notifyDownload));

// ----- 404 fallback (prevents any accidental “no return” hangs) -----
router.all("*", trace("notfound", async () =>
  new Response("Not Found", { status: 404 })
));

// Export both ways so index.ts can `import router from` OR `import { router } from`
export { router };
export default router;
