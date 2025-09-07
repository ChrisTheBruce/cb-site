// worker/handlers/chat.ts
// Minimal, robust SSE proxy to OpenAI (or CF AI Gateway) with MCP announcement.
// - Never throws raw errors to the platform (prevents Cloudflare 1101 HTML pages).
// - Returns JSON {ok:false,error:"..."} for non-stream errors.
// - Streams OpenAI SSE through to the browser and sends a final [DONE].

export interface Env {
  OPENAI_API_KEY: string;
  // Optional: set this to your CF AI Gateway OpenAI base
  // e.g. https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/<GATEWAY_NAME>/openai
  OPENAI_BASE_URL?: string;
  DEBUG_MODE?: string;
}

type InboundBody = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  mcp?: { name?: string; service?: string; [k: string]: unknown } | null;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMP = 0.5;

export async function chatHandler(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return jsonError(405, "Method Not Allowed");
    }

    let payload: InboundBody | null = null;
    try {
      payload = (await req.json()) as InboundBody;
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
      return jsonError(400, "Missing 'messages' array");
    }

    const model = payload.model || DEFAULT_MODEL;
    const temperature =
      typeof payload.temperature === "number" ? payload.temperature : DEFAULT_TEMP;

    const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const url = `${base}/chat/completions`;

    if (!env.OPENAI_API_KEY) {
      return jsonError(500, "OPENAI_API_KEY not configured");
    }

    // Call OpenAI with streaming enabled
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        stream: true,
        messages: payload.messages,
      }),
      // keepalive is not supported in Workers; omit
    });

    // If upstream fails or has no body, return a clean JSON error (don’t throw).
    if (!upstream.ok || !upstream.body) {
      const errText = await safeText(upstream);
      return jsonError(
        upstream.status || 502,
        `Upstream error ${upstream.status || 0}: ${errText.slice(0, 500)}`
      );
    }

    // Stream SSE to the client; optionally announce MCP service first.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // Announce MCP service (so the UI can show "MCP: <name>")
          if (payload?.mcp && (payload.mcp.name || payload.mcp.service)) {
            const m = JSON.stringify({ name: payload.mcp.name || payload.mcp.service });
            controller.enqueue(encoder.encode(`event: mcp\ndata: ${m}\n\n`));
          }

          // Pass the OpenAI SSE through as-is.
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            // value is bytes from upstream; forward directly
            controller.enqueue(value);
          }
        } catch (err: unknown) {
          const message = (err as any)?.message || String(err);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`));
        } finally {
          // Always terminate the stream cleanly
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (outerErr: unknown) {
    // Final guard: return JSON error; do NOT let the Worker throw.
    const message = (outerErr as any)?.message || String(outerErr);
    return jsonError(500, `Internal error: ${message}`);
  }
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

export default chatHandler;
