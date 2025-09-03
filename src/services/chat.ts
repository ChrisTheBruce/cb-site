// src/services/chat.ts
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function streamChat(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  onToken: (chunk: string) => void;
}) {
  const { messages, model = "gpt-4o", temperature = 0.5, signal, onToken } = opts;

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

    // Split by SSE event separators
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const ev of events) {
      const dataLines = ev.split("\n").filter((l) => l.startsWith("data:"));
      if (!dataLines.length) continue;
      const payload = dataLines.map((l) => l.slice(5).trim()).join("");

      if (payload === "[DONE]") return;

      // Some gateways emit non-JSON metadata events — ignore parse errors
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content ?? "";
        if (delta) onToken(delta);
      } catch {
        // ignore
      }
    }
  }
}
