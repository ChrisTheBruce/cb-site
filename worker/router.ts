// worker/router.ts
try { console.log("🐛 [router] module loaded"); } catch {}

import { Router } from "itty-router";
import type { Env } from "./env";
import { DBG } from "./env";
import { json as jsonResp } from "./lib/responses";

// Handlers (we'll adapt to whatever names you actually export)
import * as Health from "./handlers/health";
import * as Auth from "./handlers/auth";
import * as Notify from "./handlers/notify";
import * as Chat from "./handlers/chat";

type H = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> | Response;

const json = (body: any, init?: ResponseInit) =>
  (jsonResp
    ? jsonResp(body, init)
    : new Response(JSON.stringify(body), {
        ...(init || {}),
        headers: { "content-type": "application/json", ...(init?.headers || {}) },
      }));

const dbg = (...args: any[]) => { try { (DBG as any)(...args); } catch { try { console.log(...args); } catch {} } };

function pick(mod: any, names: string[]): H | null {
  for (const n of names) {
    const fn = mod?.[n];
    if (typeof fn === "function") return fn as H;
  }
  // support default export
  if (typeof mod?.default === "function") return mod.default as H;
  return null;
}

// Wrap for tracing/errors + CORS
function wrap(name: string, handler: H, { cors = false }: { cors?: boolean } = {}): H {
  return async (req, env, ctx) => {
    const t0 = Date.now();
    const { method, url } = req;
    const path = new URL(url).pathname;
    dbg("➡️", name, { method, path });

    try {
      let res = await handler(req, env, ctx);

      if (cors) {
        res = new Response(res.body, {
          headers: {
            "Access-Control-Allow-Origin": "https://www.chrisbrighouse.com",
            "Vary": "Origin",
            ...Object.fromEntries(res.headers),
          },
          status: (res as any).status ?? 200,
        });
      }

      dbg("⬅️", name, { ms: Date.now() - t0, status: (res as any).status ?? 200 });
      return res;
    } catch (err: any) {
      dbg("💥", name, {
        message: err?.message || String(err),
        stack: err?.stack?.slice?.(0, 800),
      });
      return json({ ok: false, error: "Internal error" }, { status: 500 });
    }
  };
}

export const router = Router();

// ------- CORS / Preflight helpers -------
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

router.options("/api/auth/*", preflight);
router.options("/api/chat/*", preflight);

// ------- Health (safe no-op) -------
const healthHandler =
  pick(Health, ["ping", "health", "handler"]) ??
  (async () => json({ ok: true, ts: Date.now() }));

router.get("/health", wrap("health", healthHandler));

// ------- AUTH: /api/auth/login with diagnostic bypass -------
const authLoginReal =
  pick(Auth, ["login", "authLogin", "authLoginHandler", "handleLogin", "handler"]) ??
  (async () => json({ ok: false, error: "auth login handler not found" }, { status: 501 }));

router.post(
  "/api/auth/login",
  wrap(
    "auth.login",
    async (req, env, ctx) => {
      // Diagnostic bypass: proves the route wiring returns
      if (req.headers.get("x-diag-skip-auth") === "1") {
        dbg("🔐 auth.login: diag bypass");
        return json({ ok: true, diag: "auth handler returns" });
      }
      return authLoginReal(req, env, ctx);
    },
    { cors: true }
  )
);

// Helpful ping for quick checks
router.post("/api/auth/ping", wrap("auth.ping", async () => json({ ok: true, ts: Date.now() })));

// ------- CHAT: /api/chat/stream (your real handler) -------
const chatStreamReal =
  pick(Chat, ["stream", "chatStream", "chatStreamHandler", "handler"]) ??
  (async () => json({ ok: false, error: "chat stream handler not found" }, { status: 501 }));

router.post("/api/chat/stream", wrap("chat.stream", chatStreamReal, { cors: true }));

// Optional alias if your UI ever used /ai/chat/stream
router.post("/ai/chat/stream", wrap("chat.stream.alias", chatStreamReal, { cors: true }));

// Known-good echo stream to validate streaming plumbing
router.post(
  "/api/chat/echo-stream",
  wrap(
    "chat.echo",
    async () => {
      const { readable, writable } = new TransformStream();
      const w = writable.getWriter();
      (async () => {
        try {
          for (let i = 1; i <= 5; i++) {
            await w.write(new TextEncoder().encode(`data: chunk ${i}\n\n`));
            await new Promise((r) => setTimeout(r, 250));
          }
        } catch (e) {
          dbg("echo-stream write error", String(e));
        } finally {
          await w.close();
        }
      })();
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "https://www.chrisbrighouse.com",
        },
      });
    },
    { cors: true }
  )
);

// ------- Notify (kept flexible) -------
const notifyHandler =
  pick(Notify, ["notify", "download", "notifyDownload", "handler"]) ??
  (async () => json({ ok: false, error: "notify handler not found" }, { status: 501 }));

router.post("/api/notify/download", wrap("notify.download", notifyHandler, { cors: true }));

// ------- Fallback / 404 -------
router.all("*", wrap("notfound", async (req) => {
  const u = new URL(req.url);
  dbg("⚠️ no route", { method: req.method, path: u.pathname });
  return new Response("Not Found", { status: 404 });
}));

try { console.log("🐛 [router] module ready"); } catch {}
