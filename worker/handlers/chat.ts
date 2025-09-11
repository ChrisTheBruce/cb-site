// worker/handlers/chat.ts
// SSE chat proxy with MCP announce, diagnostics, and DBG logging.
// Supports OPENAI_API (your secret) or OPENAI_API_KEY (alt). Gateway via OPENAI_BASE_URL.

try { console.log("🐛 [chat] module loaded"); } catch {}

interface Env {
  OPENAI_API?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;   // e.g. https://gateway.ai.cloudflare.com/v1/.../cb-openai/
  OPENAI_BASE?: string;       // alt common name
  AI_GATEWAY_BASE?: string;   // Cloudflare AI Gateway as set in wrangler.jsonc
  AI_GATEWAY_URL?: string;    // alt name
  DEBUG_MODE?: string;        // "1","true","yes","on","debug" → enable
}

function isDebug(env: Env): boolean {
  const v = (env.DEBUG_MODE || "").toString().trim().toLowerCase();
  return ["1", "true", "yes", "on", "debug"].includes(v);
}
function DBG(env: Env, ...args: any[]) {
  if (!isDebug(env)) return;
  try { console.log("🐛 [chat]", ...args); } catch {}
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

/** Unified handler: GET → health/SSE self-test; POST → stream via OpenAI. */
export async function handleChat(req: Request, env: Env, _ctx: ExecutionContext) {
  const url = new URL(req.url);
  console.log("🐛 [chat] enter handleChat", req.method, url.pathname + url.search);

  try {
    if (req.method === "GET") {
      if (url.searchParams.get("ping")) {
        const payload = {
          ok: true,
          route: url.pathname,
          sse_test: `${url.pathname}?test=sse=1`,
          has_key: Boolean(getApiKey(env)),
          base_url_hint: getBaseUrl(env),
          debug: isDebug(env),
        };
        DBG(env, "ping", payload);
        return json(200, payload, req);
      }
      if (url.searchParams.get("test") === "sse") {
        DBG(env, "SSE self-test start");
        return sseTest();
      }
      return json(405, { ok: false, error: "Use POST for chat (or ?ping / ?test=sse)" }, req);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    if (req.method !== "POST") {
      return json(405, { ok: false, error: "Method Not Allowed" }, req);
    }

    // Parse request
    let body: InboundBody;
    try {
      body = (await req.json()) as InboundBody;
    } catch (e: any) {
      DBG(env, "Invalid JSON body", e?.message || String(e));
      return json(400, { ok: false, error: "Invalid JSON body" }, req);
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      DBG(env, "Missing 'messages' array");
      return json(400, { ok: false, error: "Missing 'messages' array" }, req);
    }

    const apiKey = getApiKey(env);
    if (!apiKey) {
      DBG(env, "OPENAI_API missing");
      return json(500, { ok: false, error: "OPENAI_API secret not configured" }, req);
    }

    const model = body.model || DEFAULT_MODEL;
    const temperature = typeof body.temperature === "number" ? body.temperature : DEFAULT_TEMP;
    const baseUrl = getBaseUrl(env);
    const upstreamUrl = `${baseUrl}/chat/completions`;


    // --- DEBUG: upstream target + self-recursion check ---
    const reqHost = new URL(req.url).host;
    const baseHost = (() => {
      try { return new URL(baseUrl).host; } catch { return "(bad baseUrl)"; }
    })();
    DBG("chat: pre-fetch", { reqHost, baseHost, baseUrl, upstreamUrl });

    // OPTIONAL: log request headers you send upstream (helps spot loops)
    const loopMarker = crypto.randomUUID();
    DBG("chat: add X-Loop-Trace", loopMarker);
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Loop-Trace": loopMarker,         // <-- harmless debug header
    };


    DBG("Upstream config", { baseUrl, upstreamUrl, model, temperature, mcp: body?.mcp });
/* old
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, temperature, stream: true, messages: body.messages }),
    });
*/

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, temperature, stream: true, messages: body.messages }),
    });

    DBG(env, "chat: post-fetch", {
      ok: upstream.ok,
      status: upstream.status,
      ctype: upstream.headers.get("content-type") || "",
      hasBody: Boolean(upstream.body)
    });


    if (!upstream.ok || !upstream.body) {
      const errText = await safeText(upstream);
      DBG("Upstream error payload", errText?.slice(0, 400));
      return json(upstream.status || 502, {
        ok: false,
        error: `Upstream error ${upstream.status}: ${errText.slice(0, 800)}`,
      }, req);
    }

    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();

    DBG("Begin streaming…");
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
          DBG("Upstream finished", { chunks, bytes });
        } catch (e: any) {
          DBG("Streaming error", e?.message || String(e));
          controller.enqueue(encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: e?.message || String(e) })}\n\n`
          ));
        } finally {
          DBG("Emit [DONE] and close");
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
    });

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
    DBG("Outer catch", e?.message || String(e));
    return json(500, { ok: false, error: `Internal error: ${e?.message || String(e)}` }, req);
  }
}

/** Back-compat explicit stream entry (works for both GET test and POST chat). */
export async function handleChatStream(req: Request, env: Env, ctx: ExecutionContext) {
  // Reuse the same logic; the route is just a different path.
  return handleChat(req, env, ctx);
}

// ---------------------------- helpers ----------------------------
function getApiKey(env: Env): string | null {
  return (
    env.OPENAI_API?.trim?.() ||
    env.OPENAI_API_KEY?.trim?.() ||
    null
  );
}
function getBaseUrl(env: Env): string {
  // Support multiple common env var names for the base
  let base = (env.OPENAI_BASE_URL || env.AI_GATEWAY_BASE || env.AI_GATEWAY_URL || env.OPENAI_BASE || "").trim();
  if (base) {
    base = base.replace(/\/+$/, "");
    // Ensure gateway-style path includes /openai/v1
    if (!/\/(openai)(\/|$)/.test(base)) base = `${base}/openai`;
    if (!/\/(v1)(\/|$)/.test(base)) base = `${base}/v1`;
    return base;
  }
  return "https://api.openai.com/v1";
}
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
function json(status: number, obj: unknown, req: Request): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req) },
  });
}
async function safeText(r: Response): Promise<string> { try { return await r.text(); } catch { return ""; } }
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
