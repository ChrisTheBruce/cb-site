// worker/handlers/chat.ts
import type { Env } from "../env";

// Reuse your auth cookie
const AUTH_COOKIE = "cb_auth";

// ===== tiny helpers =====
function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("Cookie") || "";
  for (const part of cookie.split(/;\s*/)) {
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

// Minimal “MCP client” that calls an external geocoder.
// Here we use OpenStreetMap Nominatim (no key). Replace with your GIS later.
async function getCoordinates(query: string): Promise<{ lat: number; lon: number; source: string }> {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("format", "json");
  u.searchParams.set("q", query);
  u.searchParams.set("limit", "1");

  const res = await fetch(u.toString(), {
    headers: {
      // Be nice to OSM — identify your app
      "User-Agent": "cb-site/1.0 (+https://chrisbrighouse.com)"
    }
  });

  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const data = await res.json().catch(() => []);
  const top = Array.isArray(data) && data.length ? data[0] : null;
  if (!top || !top.lat || !top.lon) throw new Error("No results");

  return { lat: Number(top.lat), lon: Number(top.lon), source: "nominatim" };
}

// Tool definition we expose to the model (OpenAI tools/function-calling)
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

  // Require login
  if (!getCookie(req, AUTH_COOKIE)) return new Response("Unauthorized", { status: 401 });

  // Parse body
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

  // Decide whether to allow tools. For now, always allow the single geo tool.
  const tools = [GEO_TOOL_DEF];

  // ---- Phase 1: non-streamed “planner” call allowing tools ----
  // We ask the model what it wants to do; if it emits tool_calls, we run them here.
  // Then we do a second streamed call to produce the final answer with results in context.
  const planResp = await fetch(gatewayUrl(env, "chat/completions"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature,
      stream: false,
      tools,
      tool_choice: "auto",
      messages
    })
  });

  if (!planResp.ok) {
    const t = await planResp.text().catch(() => "");
    return new Response(t || "Upstream error (plan)", { status: planResp.status || 502 });
  }

  const plan = await planResp.json();
  const assistantMsg = plan?.choices?.[0]?.message ?? {};
  const toolCalls = assistantMsg?.tool_calls || [];

  // If no tool requested, fall back to simple streaming pass-through using original messages.
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    const upstream = await fetch(gatewayUrl(env, "chat/completions"), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
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

  // ---- Phase 2: execute tool(s), then streamed answer ----
  // We currently support only our single getCoordinates tool.
  const toolMessages: any[] = [];
  for (const tc of toolCalls) {
    try {
      const name = tc?.function?.name || tc?.name;
      const argsRaw = tc?.function?.arguments || "{}";
      if (name !== "getCoordinates") continue;

      let args: any = {};
      try { args = JSON.parse(argsRaw); } catch { args = {}; }
      const q = String(args?.query ?? "").trim();
      if (!q) throw new Error("query required");

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

  // Build a new message list:
  // original messages + the assistant's tool_call message + our tool result(s)
  const followupMessages = [...messages, { role: "assistant", ...assistantMsg }, ...toolMessages];

  // Stream the final natural-language answer that uses the tool results
  const finalResp = await fetch(gatewayUrl(env, "chat/completions"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature,
      stream: true,
      messages: followupMessages
    })
  });

  if (!finalResp.ok || !finalResp.body) {
    const text = await finalResp.text().catch(() => "");
    return new Response(text || "Upstream error (final)", { status: finalResp.status || 502 });
  }

  const h = new Headers(finalResp.headers);
  h.set("Content-Type", "text/event-stream; charset=utf-8");
  h.set("Cache-Control", "no-cache");
  h.set("Connection", "keep-alive");
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Credentials", "true");
  return new Response(finalResp.body, { status: 200, headers: h });
}
