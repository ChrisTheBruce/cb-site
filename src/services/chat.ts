// src/services/chat.ts
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type StreamOptions = {
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  // Optional: pass MCP meta so the worker can announce it
  mcp?: { name?: string; service?: string; [k: string]: unknown };
};

/**
 * Streams assistant output from /api/chat as plain text chunks.
 * - Parses SSE directly.
 * - Emits a visible "MCP: <name>" line when the worker announces the MCP service.
 * - Throws clean errors (won’t dump HTML into the UI).
 */
export async function* streamChat(
  messages: ChatMessage[],
  opts: StreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  const model = opts.model ?? "gpt-4o-mini";
  const temperature = opts.temperature ?? 0.5;

  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Ask for SSE; the worker will oblige
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      messages,
      model,
      temperature,
      // pass-through MCP info so worker can emit an announcement event
      mcp: opts.mcp ?? null,
    }),
    signal: opts.signal,
  });

  // If the worker returned a non-200, read the text once and throw a clean error.
  if (!resp.ok) {
    const text = await safeText(resp);
    // If we accidentally got HTML (e.g., Cloudflare error page), don’t stream it to the UI.
    if (resp.headers.get("content-type")?.includes("text/html")) {
      throw new Error(`Chat HTTP ${resp.status} (HTML error page)`);
    }
    // If worker returned JSON error object, prefer that.
    try {
      const j = JSON.parse(text);
      if (j?.error) throw new Error(`Chat ${resp.status}: ${j.error}`);
    } catch {
      /* fall through */
    }
    throw new Error(`Chat ${resp.status}: ${text.slice(0, 300)}`);
  }

  // We expect SSE
  const reader = resp.body?.getReader();
  if (!reader) throw new Error("Empty response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Split on the SSE record boundary (blank line)
    const records = buffer.split(/\r?\n\r?\n/);
    buffer = records.pop() ?? "";

    for (const rec of records) {
      // Each record is multiple lines (event:/data:/etc.)
      const lines = rec.split(/\r?\n/);
      currentEvent = null;

      for (const line of lines) {
        if (!line) continue;

        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
          continue;
        }

        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();

        // Standard SSE terminator from our worker
        if (data === "[DONE]") {
          return;
        }

        // Our worker proxies OpenAI SSE (JSON lines), and also emits an `event: mcp` JSON line.
        if (currentEvent === "mcp") {
          try {
            const m = JSON.parse(data);
            const name = m?.name ?? m?.service ?? "connected";
            yield `MCP: ${name}\n`;
          } catch {
            // If not JSON, still display something
            if (data) yield `MCP: ${data}\n`;
          }
          continue;
        }

        // Normal OpenAI SSE (proxy) — parse the delta
        try {
          const j = JSON.parse(data);
          // OpenAI chat.completions stream line
          const delta =
            j?.choices?.[0]?.delta?.content ??
            j?.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments ??
            "";

          if (delta) yield delta;
        } catch {
          // If we got a non-JSON chunk, emit it as-is (defensive)
          if (data && !data.startsWith("{")) {
            yield data;
          }
        }
      }
    }
  }
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

export default streamChat;
