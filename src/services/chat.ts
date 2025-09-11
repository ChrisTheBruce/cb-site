// src/services/chat.ts
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type StreamOptions = {
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  mcp?: { name?: string; service?: string; [k: string]: unknown };
  onMcp?: (info: { name?: string; service?: string; tool?: string }) => void;
  onToken?: (chunk: string) => void;
};

const CHAT_PATH =
  (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_CHAT_PATH) ||
  "/api/chat/stream";

export async function streamChat(opts: {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  mcp?: { name?: string; service?: string; [k: string]: unknown } | null;
  onMcp?: (info: { name?: string; service?: string; tool?: string }) => void;
  onToken?: (chunk: string) => void;
}): Promise<void> {
  const {
    messages,
    model = "gpt-4o-mini",
    temperature = 0.5,
    signal,
    mcp = null,
    onMcp,
    onToken,
  } = opts;

  const resp = await fetch(CHAT_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ messages, model, temperature, mcp }),
    signal,
  });

  if (!resp.ok) {
    const text = await safeText(resp);
    if (resp.headers.get("content-type")?.includes("text/html")) {
      throw new Error(`Chat HTTP ${resp.status} (HTML error page)`);
    }
    try {
      const j = JSON.parse(text);
      if (j?.error) throw new Error(`Chat ${resp.status}: ${j.error}`);
    } catch {}
    throw new Error(`Chat ${resp.status}: ${text.slice(0, 300)}`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error("Empty response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const records = buffer.split(/\r?\n\r?\n/);
    buffer = records.pop() ?? "";

    for (const rec of records) {
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

        if (data === "[DONE]") return;

        if (currentEvent === "mcp") {
          try {
            const m = JSON.parse(data);
            onMcp?.({ name: m?.name, service: m?.service, tool: m?.tool });
          } catch {
            onMcp?.({ service: data });
          }
          continue;
        }

        try {
          const j = JSON.parse(data);
          const delta =
            j?.choices?.[0]?.delta?.content ??
            j?.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments ??
            "";
          if (delta) onToken?.(delta);
        } catch {
          if (data && !data.startsWith("{")) onToken?.(data);
        }
      }
    }
  }
}

async function safeText(r: Response): Promise<string> {
  try { return await r.text(); } catch { return ""; }
}
export default streamChat;
