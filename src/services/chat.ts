// src/services/chat.ts
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type StreamOptions = {
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
};

export async function* streamChat(
  messages: ChatMessage[],
  opts: StreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  const model = opts.model ?? "gpt-4o";
  const temperature = opts.temperature ?? 0.5;

  const res = await fetch("/api/chat", {
    method: "POST",
    credentials: "include", // harmless if your endpoint doesn’t require cookies
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ model, temperature, messages }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await safeText(res).catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  // Autodetect SSE vs raw (your Worker should be SSE)
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sseMode: boolean | undefined;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      if (sseMode === undefined) {
        sseMode = chunk.includes("data:") || chunk.includes("event:");
      }

      if (sseMode) {
        buffer += chunk;
        let idx = indexOfDoubleNewline(buffer);
        while (idx !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for await (const out of parseSseFrame(frame)) yield out;
          idx = indexOfDoubleNewline(buffer);
        }
      } else {
        // raw streaming fallback
        yield chunk;
      }
    }

    if (!sseMode && buffer) yield buffer;
  } finally {
    try {
      reader.releaseLock();
      await res.body.cancel().catch(() => {});
    } catch {}
  }
}

// ---- helpers ----
function indexOfDoubleNewline(s: string): number {
  const norm = s.replace(/\r\n/g, "\n");
  const pos = norm.indexOf("\n\n");
  if (pos === -1) return -1;
  const rawPos = s.indexOf("\n\n");
  return rawPos !== -1 ? rawPos : pos;
}

async function* parseSseFrame(frame: string): AsyncGenerator<string, void, unknown> {
  if (!frame.trim()) return;

  const lines = frame.replace(/\r\n/g, "\n").split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const raw of lines) {
    const line = raw.trimStart();
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() || "message";
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    yield frame;
    return;
  }

  for (const data of dataLines) {
    if (data === "[DONE]") continue;

    // Prefer JSON; fall back to raw text
    try {
      const obj = JSON.parse(data);

      // MCP event (either via eventName or explicit type)
      if (eventName === "mcp" || obj?.type === "mcp") {
        const name =
          obj?.service ?? obj?.name ?? obj?.tool ?? obj?.tool_name ?? obj?.toolName ?? "unknown";
        yield `MCP: ${String(name)}\n`;
        const extra = extractText(obj);
        if (extra) yield extra;
        continue;
      }

      const text = extractText(obj);
      if (text) {
        yield text;
      } else {
        yield data;
      }
    } catch {
      yield data;
    }
  }
}

function extractText(obj: any): string {
  if (typeof obj?.content === "string") return obj.content;
  if (typeof obj?.text === "string") return obj.text;

  const choices = obj?.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const c = choices[0]?.delta ?? choices[0];
    const t = pickFromContentArray(c?.content);
    if (t) return t;
  }

  const delta = obj?.delta;
  if (delta) {
    const t = pickFromContentArray(delta?.content);
    if (t) return t;
  }

  return "";
}

function pickFromContentArray(content: any): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => {
      if (!c) return "";
      if (typeof c === "string") return c;
      if (typeof c?.text === "string") return c.text;
      if (typeof c?.value === "string") return c.value;
      return "";
    })
    .join("");
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

export default streamChat;
