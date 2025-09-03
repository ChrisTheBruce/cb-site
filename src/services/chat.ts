// src/services/chat.ts
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function streamChat(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  onToken: (chunk: string) => void;
  onMcp?: (info: { service?: string; tool?: string }) => void; // NEW
}) {
  const { messages, model = "gpt-4o", temperature = 0.5, signal, onToken, onMcp } = opts;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ messages, model, temperature }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Split into SSE events
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const ev of events) {
      // Parse event name + data payload(s)
      const lines = ev.split("\n");
      let evt = "message";
      const dataParts: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) evt = line.slice(6).trim();
        if (line.startsWith("data:")) dataParts.push(line.slice(5).trim());
      }
      const payload = dataParts.join("");

      if (evt === "mcp") {
        // Our custom MCP announce
        try {
          const info = JSON.parse(payload || "{}");
          onMcp?.(info);
        } catch {
          onMcp?.({});
        }
        continue;
      }

      if (!payload) continue;
      if (payload === "[DONE]") return;

      // Normal OpenAI deltas
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length) {
          onToken(delta);
          continue;
        }
        const full = json?.choices?.[0]?.message?.content;
        if (typeof full === "string" && full.length) {
          onToken(full);
          continue;
        }
      } catch {
        // ignore non-JSON metadata
      }
    }
  }
}
