// worker/handlers/chat.ts
import type { Env } from "../env";

// minimal cookie reader (same name as auth handler)
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

export async function chatStream(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Require login (same cookie used by your auth)
  const authed = !!getCookie(req, "cb_auth");
  if (!authed) return new Response("Unauthorized", { status: 401 });

  // Parse body
  let payload: any = null;
  try { payload = await req.json(); } catch {}
  if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return new Response("messages[] required", { status: 400 });
  }

  const model = payload.model || "gpt-4o";
  const temperature = typeof payload.temperature === "number" ? payload.temperature : 0.5;

  // Build AI Gateway URL: <AI_GATEWAY_BASE>/openai/chat/completions
  const base = (env as any).AI_GATEWAY_BASE as string | undefined;
  const key = (env as any).OPENAI_API as string | undefined;
  if (!base || !key) return new Response("Gateway not configured", { status: 500 });

  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/?$/, "/") + "openai/chat/completions";

  const upstream = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      stream: true,
      messages: payload.messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return new Response(text || "Upstream error", { status: upstream.status || 502 });
  }

  // Pass-through SSE
  const h = new Headers(upstream.headers);
  h.set("Content-Type", "text/event-stream; charset=utf-8");
  h.set("Cache-Control", "no-cache");
  h.set("Connection", "keep-alive");
  // CORS (same-origin is fine, but harmless to include)
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Credentials", "true");

  return new Response(upstream.body, { status: 200, headers: h });
}
