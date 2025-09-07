// worker/handlers/chat.ts
interface Env {
  OPENAI_API?: string;       // your secret name
  OPENAI_API_KEY?: string;   // alt accepted
  OPENAI_BASE_URL?: string;  // e.g. https://gateway.ai.cloudflare.com/v1/.../cb-openai/
  DEBUG_MODE?: string;
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
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      if (url.searchParams.get("ping")) {
        return json(200, {
          ok: true,
          route: "/api/chat",
          sse_test: "/api/chat?test=sse=1",
          has_key: Boolean(getApiKey(env)),
          base_url_hint: getBaseUrl(env),
        }, req);
      }
      if (url.searchParams.get("test") === "sse") {
        return sseTest();
      }
      return json(405, { ok: false, error: "Use POST for chat (or ?ping / ?test=sse)" }, req);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req, false) });
    }

    if (req.method !== "POST") {
      return json(405, { ok: false, error: "Method Not Allowed" }, req);
    }

    let body: InboundBody;
    try {
      body = (await req.json()) as InboundBody;
    } catch {
      return json(400, { ok: false, error: "Invalid JSON body" }, req);
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json(400, { ok: false, error: "Missing 'messages' array" }, req);
    }

    const apiKey = getApiKey(env);
    if (!apiKey) {
      return json(500, { ok: false, error: "OPENAI_API secret not configured" }, req);
    }

    const model = body.model || DEFAULT_MODEL;
    const temperature = typeof body.temperature === "number" ? body.temperature : DEFAULT_TEMP;
    const upstreamUrl = `${getBaseUrl(env)}/chat/completions`;

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, temperature, stream: true, messages: body.messages }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await safeText(upstream);
      return json(upstream.status || 502, {
        ok: false,
        error: `Upstream error ${upstream.status}: ${errText.slice(0, 800)}`,
      }, req);
    }

    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (body?.mcp && (body.mcp.name || body.mcp.service)) {
            const name = body.mcp.name || body.mcp.service;
            controller.enqueue(
              encoder.encode(`event: mcp\ndata: ${JSON.stringify({ name })}\n\n`)
            );
          }
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (e: any) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: e?.message || String(e) })}\n\n`
            )
          );
        } finally {
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders(req, false),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, error: `Internal error: ${e?.message || String(e)}` }, req);
  }
}

// Pages Functions compatibility (harmless in Workers if unused)
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

function json(status: number, obj: unknown, req: Request): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req, false) },
  });
}

async function safeText(r: Response): Promise<string> {
  try { return await r.text(); } catch { return ""; }
}

// Allow the current Origin in dev/preview/prod; fall back to "*" for curl
function corsHeaders(req: Request, allowCredentials: boolean): Record<string, string> {
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
