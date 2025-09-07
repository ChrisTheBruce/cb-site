// worker/handlers/chat.ts
export interface Env {
  AI_GATEWAY_BASE: string; // e.g. https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/
  OPENAI_API: string;      // raw OpenAI API key, used by Gateway
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

function requireEnv(env: Env) {
  if (!env.AI_GATEWAY_BASE) throw new Error("AI_GATEWAY_BASE not set");
  if (!env.OPENAI_API) throw new Error("OPENAI_API not set");
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base : base + "/";
  return new URL(path.replace(/^\/+/, ""), b).toString();
}

function sseHeaders(): Headers {
  return new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    // Helpful when fronting through CF/Pages
    "Transfer-Encoding": "chunked",
    "X-Accel-Buffering": "no",
  });
}

function encodeEvent(eventName: string | null, data: string): Uint8Array {
  const head = eventName ? `event: ${eventName}\n` : "";
  return new TextEncoder().encode(`${head}data: ${data}\n\n`);
}

async function* forwardSse(upstream: ReadableStream<Uint8Array>) {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

/**
 * Emit the MCP prelude event if you decide to call an MCP service.
 * Call this BEFORE proxying the OpenAI stream.
 */
function emitMcpPrelude(controller: ReadableStreamDefaultController<Uint8Array>, service: string) {
  const payload = JSON.stringify({ type: "mcp", service });
  controller.enqueue(encodeEvent("mcp", payload));
}

/**
 * Main handler
 * Expects POST JSON: { model?: string, temperature?: number, messages: ChatMsg[] }
 * Streams SSE to the client and guarantees closure in all paths.
 */
export async function chatStream(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    requireEnv(env);
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || "Gateway not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages: ChatMsg[] = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "messages[] required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const model = typeof body?.model === "string" ? body.model : "gpt-4o";
  const temperature =
    typeof body?.temperature === "number" && !Number.isNaN(body.temperature)
      ? body.temperature
      : 0.5;

  // Build Gateway URL: <AI_GATEWAY_BASE>/openai/chat/completions
  const upstreamUrl = joinUrl(env.AI_GATEWAY_BASE, "openai/chat/completions");

  // Optional: if your existing logic decides to call MCP, compute the service name here.
  // Preserve your behavior by keeping whatever condition you previously had.
  // Example: const mcpService = shouldUseMcp(messages) ? "getCoordinates" : null;
  const mcpService: string | null = null; // <-- Keep as `null` unless you set it based on your existing logic.

  // Safety: time out the upstream if it stalls (prevents "hung" requests).
  const UPSTREAM_TIMEOUT_MS = 90_000;
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort("upstream-timeout"), UPSTREAM_TIMEOUT_MS);

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      try {
        // If you decided to use MCP for this prompt, announce it to the client.
        if (mcpService) {
          emitMcpPrelude(controller, mcpService);
        }

        const upstreamRes = await fetch(upstreamUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API}`,
            "Accept": "text/event-stream",
          },
          body: JSON.stringify({
            model,
            temperature,
            stream: true,
            messages, // Already in {role, content} shape expected by OpenAI
          }),
          signal: ac.signal,
        });

        if (!upstreamRes.ok || !upstreamRes.body) {
          const text = await upstreamRes.text().catch(() => "");
          const msg = `Upstream ${upstreamRes.status} ${upstreamRes.statusText}${text ? `: ${text}` : ""}`;
          controller.enqueue(encodeEvent("error", JSON.stringify({ message: msg })));
          controller.enqueue(encodeEvent(null, "[DONE]"));
          controller.close();
          return;
        }

        // Forward upstream SSE as-is to the client
        for await (const chunk of forwardSse(upstreamRes.body)) {
          // Just relay the text chunks; OpenAI already emits proper `data:` lines
          controller.enqueue(new TextEncoder().encode(chunk));
          // Optional: you can sniff for `[DONE]` here, but upstream EOF also closes us.
          if (chunk.includes("[DONE]")) {
            // We can close early to avoid Workers “hung” if provider leaves connection lingering.
            controller.close();
            return;
          }
        }

        // Upstream ended cleanly — close the client stream
        controller.close();
      } catch (err: any) {
        // Surface the error as an SSE event, then close; prevents runtime hang.
        const message = typeof err?.message === "string" ? err.message : String(err);
        controller.enqueue(encodeEvent("error", JSON.stringify({ message })));
        controller.enqueue(encodeEvent(null, "[DONE]"));
        try { controller.close(); } catch {}
      } finally {
        clearTimeout(timeoutId);
      }
    },
    cancel: () => {
      try { ac.abort("client-cancelled"); } catch {}
      clearTimeout(timeoutId);
    },
  });

  const headers = sseHeaders();
  // Hold the stream open even if the handler scope finishes
  ctx.waitUntil(Promise.resolve());

  return new Response(stream, { status: 200, headers });
}


/*
// worker/handlers/chat.ts
import type { Env } from "../env";

const AUTH_COOKIE = "cb_auth";

// ===== helpers =====
function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("Cookie") || "";
  for (const part of cookie.split(/;\s)) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    if (k === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

function gatewayUrl(env: Env, openaiPath: string): string {
  const base = (env as any).AI_GATEWAY_BASE as string | undefined;
  if (!base) throw new Error("Gateway not configured");
  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/?$/, "/") + ("openai/" + openaiPath.replace(/^\/+/, ""));
  return url.toString();
}

// Minimal external geocoder used as our MCP stand-in
async function getCoordinates(query: string): Promise<{ lat: number; lon: number; source: string }> {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("format", "json");
  u.searchParams.set("q", query);
  u.searchParams.set("limit", "1");

  const res = await fetch(u.toString(), {
    headers: { "User-Agent": "cb-site/1.0 (+https://chrisbrighouse.com)" }
  });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const data = await res.json().catch(() => []);
  const top = Array.isArray(data) && data.length ? data[0] : null;
  if (!top || !top.lat || !top.lon) throw new Error("No results");
  return { lat: Number(top.lat), lon: Number(top.lon), source: "nominatim" };
}

const GEO_TOOL_DEF = {
  type: "function",
  function: {
    name: "getCoordinates",
    description: "Geocode a place name (city, address, landmark) to latitude/longitude.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Place to geocode, e.g. 'Paris, France'." }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
} as const;

// ===== main handler =====
export async function chatStream(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!getCookie(req, AUTH_COOKIE)) return new Response("Unauthorized", { status: 401 });

  let body: any = null;
  try { body = await req.json(); } catch {}
  const messages = body?.messages;
  const model = body?.model || "gpt-4o";
  const temperature = (typeof body?.temperature === "number") ? body.temperature : 0.5;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("messages[] required", { status: 400 });
  }

  const key = (env as any).OPENAI_API as string | undefined;
  if (!key) return new Response("Gateway not configured", { status: 500 });

  const tools = [GEO_TOOL_DEF];

  // Phase 1: planning (allow tools, not streamed)
  const planResp = await fetch(gatewayUrl(env, "chat/completions"), {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature, stream: false, tools, tool_choice: "auto", messages })
  });
  if (!planResp.ok) {
    const t = await planResp.text().catch(() => "");
    return new Response(t || "Upstream error (plan)", { status: planResp.status || 502 });
  }
  const plan = await planResp.json();
  const assistantMsg = plan?.choices?.[0]?.message ?? {};
  const toolCalls = assistantMsg?.tool_calls || [];

  // No tool? Just pass-through streaming
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    const upstream = await fetch(gatewayUrl(env, "chat/completions"), {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature, stream: true, messages })
    });
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return new Response(text || "Upstream error", { status: upstream.status || 502 });
    }
    const h = new Headers(upstream.headers);
    h.set("Content-Type", "text/event-stream; charset=utf-8");
    h.set("Cache-Control", "no-cache");
    h.set("Connection", "keep-alive");
    h.set("Access-Control-Allow-Origin", "*");
    h.set("Access-Control-Allow-Credentials", "true");
    return new Response(upstream.body, { status: 200, headers: h });
  }

  // Execute tools (our single MCP-like tool)
  const toolMessages: any[] = [];
  const mcpEvents: Array<{ service: string; tool: string }> = [];
  for (const tc of toolCalls) {
    try {
      const name = tc?.function?.name || tc?.name;
      const argsRaw = tc?.function?.arguments || "{}";
      if (name !== "getCoordinates") continue;

      let args: any = {};
      try { args = JSON.parse(argsRaw); } catch { args = {}; }
      const q = String(args?.query ?? "").trim();
      if (!q) throw new Error("query required");

      // Record MCP event for the client UI
      mcpEvents.push({ service: "Nominatim", tool: "getCoordinates" });

      const res = await getCoordinates(q);
      toolMessages.push({
        role: "tool",
        tool_call_id: tc.id || tc?.function?.name || "getCoordinates",
        name: "getCoordinates",
        content: JSON.stringify(res)
      });
    } catch (err: any) {
      toolMessages.push({
        role: "tool",
        tool_call_id: tc.id || tc?.function?.name || "getCoordinates",
        name: "getCoordinates",
        content: JSON.stringify({ error: String(err?.message || err || "tool failed") })
      });
    }
  }

  const followupMessages = [...messages, { role: "assistant", ...assistantMsg }, ...toolMessages];

  // Final streamed answer — but prepend our custom SSE “mcp” event(s)
  const finalResp = await fetch(gatewayUrl(env, "chat/completions"), {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature, stream: true, messages: followupMessages })
  });
  if (!finalResp.ok || !finalResp.body) {
    const text = await finalResp.text().catch(() => "");
    return new Response(text || "Upstream error (final)", { status: finalResp.status || 502 });
  }

  const encoder = new TextEncoder();
  const upstreamReader = finalResp.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Emit an SSE 'mcp' event per tool call so the UI can show "MCP: <service>"
      for (const e of mcpEvents) {
        const event = `event: mcp\ndata: ${JSON.stringify(e)}\n\n`;
        controller.enqueue(encoder.encode(event));
      }
      // Pipe the upstream SSE tokens through
      for (;;) {
        const { value, done } = await upstreamReader.read();
        if (done) break;
        if (value) controller.enqueue(value);
      }
      controller.close();
    }
  });

  const h = new Headers(finalResp.headers);
  h.set("Content-Type", "text/event-stream; charset=utf-8");
  h.set("Cache-Control", "no-cache");
  h.set("Connection", "keep-alive");
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Credentials", "true");
  return new Response(stream, { status: 200, headers: h });
}
*/