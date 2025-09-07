// worker/handlers/chat.ts
// Robust SSE chat proxy with MCP announce, diagnostics, and DBG logging.
// Uses OPENAI_API (your secret) or OPENAI_API_KEY (alt). Gateway supported via OPENAI_BASE_URL.

// --- MODULE-LOAD CANARY (prints even if DEBUG is off) ---
try { console.log("🐛 [chat] module loaded"); } catch { /* ignore */ }

interface Env {
  OPENAI_API?: string;       // your secret name
  OPENAI_API_KEY?: string;   // alt accepted
  OPENAI_BASE_URL?: string;  // e.g. https://gateway.ai.cloudflare.com/v1/.../cb-openai/
  DEBUG_MODE?: string;       // "1", "true", "yes", "on", "debug" → enable logs
}

// ---------- Debug helpers ----------
function isDebug(env: Env): boolean {
  const val = (env.DEBUG_MODE || "").toString().trim().toLowerCase();
  return ["1", "true", "yes", "on", "debug"].includes(val);
}

/** Prefer global DBG(env, ...args) if present; else console.log. */
function DBG(env: Env, ...args: any[]) {
  if (!isDebug(env)) return;
  try {
    const g: any = globalThis as any;
    if (typeof g.DBG === "function") { g.DBG(env, ...args); return; }
  } catch { /* ignore */ }
  try { console.log("🐛 [chat]", ...args); } catch { /* ignore */ }
}

type Msg = { role: "system" | "user" | "assistant"; content: string };
type InboundBody = {
  messages: Msg[];
  model?: string;
  temperature?: number;
  mcp?: { name?: string; service?: string; [k: string]: unknown } | null;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMP = 0.5;

export default async function chat(req: Request, env: Env, ctx: ExecutionContext) {
  return handleChat(req, env, ctx);
}

export async function handleChat(req: Request, env: Env, _ctx: ExecutionContext) {
  const url = new URL(req.url);
  try {
    DBG(env, "↘︎ enter handleChat", { method: req.method, path: url.pathname, qs: url.search });

    if (req.method === "GET") {
      if (url.searchParams.get("ping")) {
        const payload = {
          ok: true,
          route: "/api/chat",
          sse_test: "/api/chat?test=sse=1",
          has_key: Boolean(getApiKey(env)),
          base_url_hint: getBaseUrl(env),
          debug: isDebug(env),
        };
        DBG(env, "ping", payload);
        return json(200, payload, req, env);
      }
      if (url.searchParams.get("test") === "sse") {
        DBG(env, "SSE self-test start");
        const res = sseTest();
        DBG(env, "SSE self-test returned Response");
        return res;
      }
      DBG(env, "GET without ?ping / ?test=sse → 405");
      return json(405, { ok: false, error: "Use POST for chat (or ?ping / ?test=sse)" }, req, env);
    }

    if (req.method === "OPTIONS") {
      DBG(env, "OPTIONS preflight");
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    if (req.method !== "POST") {
      DBG(env, `Method not allowed: ${req.method}`);
      return json(405, { ok: false, error: "Method Not Allowed" }, req, env);
    }

    DBG(env, "Parsing JSON body…");
    let body: InboundBody;
    try {
      body = (await req.json()) as InboundBody;
    } catch (e: any) {
      DBG(env, "Invalid JSON body", e?.message || String(e));
      return json(400, { ok: false, error: "Invalid JSON body" }, req, env);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      DBG(env, "Missing 'messages' array");
      return json(400, { ok: false, error: "Missing 'messages' array" }, req, env);
    }

    const apiKey = getApiKey(env);
    if (!apiKey) {
      DBG(env, "OPENAI_API missing/unset");
      return json(500, { ok: false, error: "OPENAI_API secret not configured" }, req, env);
    }

    const model = body.model || DEFAULT_MODEL;
    const temperature = typeof body.temperature === "number" ? body.temperature : DEFAULT_TEMP;
    const baseUrl = getBaseUrl(env);
    const upstreamUrl = `${baseUrl}/chat/completions`;

    DBG(env, "Upstream config", {
      baseUrl, upstreamUrl, model, temperature,
      mcp: body?.mcp ? (body.mcp.name || body.mcp.service || true) : false,
    });

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, temperature, stream: true, messages: body.messages }),
    });

    DBG(env, "Upstream response", {
      status: upstream.status,
      ok: upstream.ok,
      hasBody: Boolean(upstream.body),
      ctype: upstream.headers.get("content-type") || "",
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await safeText(upstream);
      DBG(env, "Upstream error payload", errText?.slice(0, 400));
      return json(
        upstream.status || 502,
        { ok: false, error: `Upstream error ${upstream.status}: ${errText.slice(0, 800)}` },
        req, env
      );
    }

    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();

    DBG(env, "Begin streaming…");
    let bytes = 0, chunks = 0;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (body?.mcp && (body.mcp.name || body.mcp.service)) {
            const name = body.mcp.name || body.mcp.service;
            DBG(env, "Emit MCP announce", name);
            controller.enqueue(encoder.encode(`event: mcp\ndata: ${JSON.stringify({ name })}\n\n`));
          }
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks++; bytes += value?.byteLength || 0;
            if (chunks === 1 || chunks % 20 === 0) DBG(env, "stream chunk", { chunks, bytes });
            controller.enqueue(value);
          }
          DBG(env, "Upstream finished", { chunks, bytes });
        } catch (e: any) {
          DBG(env, "Streaming error", e?.message || String(e));
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: e?.message || String(e) })}\n\n`));
        } finally {
          DBG(env, "Emit [DONE] and close");
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
      cancel(reason) { DBG(env, "ReadableStream cancel", String(reason || "unknown")); },
    });

    DBG(env, "Return SSE response");
    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders(req),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Robots-Tag": "noindex",
      },
    });

  } catch (e: any) {
    DBG(env, "Outer catch", e?.message || String(e));
    return json(500, { ok: false, error: `Internal error: ${e?.message || String(e)}` }, req, env);
  }
}

// Pages Functions compatibility
export async function onRequestPost(context: any) {
  const { request, env } = context;
  return handleChat(request, env as Env, {} as ExecutionContext);
}

// ---------------------------- Helpers ----------------------------
function getApiKey(env: Env): string | null {
  return env.OPENAI_API?.trim?.() || env.OPENAI_API_KEY?.trim?.() || null;
}
function getBaseUrl(env: Env): string {
  let base = (env.OPENAI_BASE_URL || "").trim();
  if (base) {
    base = base.replace(/\/+$/, "");
    if (!/\/openai$/.test(base)) base = `${base}/openai`;
    return base;
  }
  return "https://api.openai.com/v1";
}
async function json(status: number, obj: unknown, req: Request, env: Env): Promise<Response> {
  DBG(env, "json()", { status, keys: Object.keys((obj as any) || {}) });
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req) },
  });
}
async function safeText(r: Response): Promise<string> { try { return await r.text(); } catch { return ""; } }
function corsHeaders(req: Request, allowCredentials = false): Record<string, string> {
  const origin = req.headers.get("Origin") || "*";
  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };
  if (allowCredentials) h["Access-Control-Allow-Credentials"] = "true";
  return h;
}
function sseTest(): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(`event: mcp\ndata: {"name":"TestService"}\n\n`));
      controller.enqueue(enc.encode(`data: This is a test SSE stream.\n\n`));
      controller.enqueue(enc.encode(`data: It proves routing & streaming work.\n\n`));
      controller.enqueue(enc.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Robots-Tag": "noindex",
    },
  });
}
