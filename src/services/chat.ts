// src/services/chat.ts
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamOptions = {
  model?: string;
  signal?: AbortSignal;
  // keep space for future flags (temperature, tools, etc.)
  [k: string]: unknown;
};

/**
 * Async generator that yields text chunks to be appended to your transcript.
 * - Works with raw text streams AND SSE ("event:" / "data:" frames).
 * - Preserves MCP visibility: when an MCP call is announced by the server
 *   (either `event: mcp` or JSON `{type:"mcp", service:"..."}`), we yield a
 *   human-readable line like `MCP: <service>\n`.
 */
export async function* streamChat(
  messages: ChatMessage[],
  opts: StreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      // Accept both text/event-stream and text/plain
      Accept: "text/event-stream, text/plain",
    },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages,
      // pass-through for server to ignore/accept
      ...opts,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const msg = await safeText(res).catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${msg ? `: ${msg}` : ""}`);
  }
  if (!res.body) {
    throw new Error("No response body to stream");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseMode: boolean | undefined; // autodetect
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (sseMode === undefined) {
        // First-touch detection
        if (chunk.includes("data:") || chunk.includes("event:")) sseMode = true;
        else sseMode = false;
      }

      if (sseMode) {
        buffer += chunk;
        // Split complete SSE frames on blank line
        let idx = indexOfDoubleNewline(buffer);
        while (idx !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2); // skip the \n\n (or \r\n\r\n normalized)
          for await (const out of parseSseFrame(frame)) {
            yield out;
          }
          idx = indexOfDoubleNewline(buffer);
        }
      } else {
        // Raw streaming text (no SSE semantics detected)
        yield chunk;
      }
    }

    // Flush any trailing text (non-SSE) if present
    if (!sseMode && buffer) {
      yield buffer;
      buffer = "";
    }
  } finally {
    try {
      reader.releaseLock();
      // Some runtimes throw if cancel called after done; that's okay.
      await res.body.cancel().catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

// ---- helpers --------------------------------------------------------------

function indexOfDoubleNewline(s: string): number {
  // Normalize CRLF to LF first to simplify
  const n = s.replace(/\r\n/g, "\n");
  const pos = n.indexOf("\n\n");
  if (pos === -1) return -1;

  // We returned a position in the normalized string; map to original by
  // recomputing with slices. For simplicity on browsers, just return the index
  // in the original string that corresponds to the first of the two newlines.
  // This small difference doesn't matter because we slice using "\n\n" length.
  return s.indexOf("\n\n") !== -1 ? s.indexOf("\n\n") : pos;
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

/**
 * Parses a single SSE frame and yields one or more text chunks.
 *
 * Supported inputs:
 *  - event: message | mcp | <other>
 *  - data: JSON (OpenAI-style deltas or our custom shape) or raw text
 *
 * Output:
 *  - For `event: mcp` or JSON `{type:"mcp"}`, yield a single line:
 *      "MCP: <service || name>\n"
 *  - For OpenAI-style deltas, yield concatenated text.
 *  - For plain text, yield the text.
 */
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
    // No data lines—treat the entire frame as text
    yield frame;
    return;
  }

  for (const data of dataLines) {
    if (data === "[DONE]") continue;

    // Try JSON, else raw text
    try {
      const obj = JSON.parse(data);

      // 1) Explicit MCP structures
      //    Accept both our custom `{type:'mcp', service:'...'}` and variants
      if (eventName === "mcp" || obj?.type === "mcp") {
        const name =
          obj?.service ??
          obj?.name ??
          obj?.tool ??
          obj?.tool_name ??
          obj?.toolName ??
          "unknown";
        yield `MCP: ${String(name)}\n`;
        // If there is optional human-readable text, surface it too
        const txt = extractText(obj);
        if (txt) yield txt;
        continue;
      }

      // 2) Generic/OpenAI-style deltas → extract text
      const text = extractText(obj);
      if (text) {
        yield text;
      } else {
        // Unknown JSON shape — surface as-is (safe)
        yield data;
      }
    } catch {
      // Not JSON → raw text (could already contain "MCP: ..." from server)
      yield data;
    }
  }
}

/**
 * Attempts to extract human-readable text from common streaming shapes.
 * Supports:
 *  - { content: "..." }
 *  - { text: "..." }
 *  - { delta: { content: [{type:'text', text:'...'}] } }
 *  - { choices: [{ delta: { content: [... as above ] } }] }  // OpenAI chat
 */
function extractText(obj: any): string {
  // Direct fields
  if (typeof obj?.content === "string") return obj.content;
  if (typeof obj?.text === "string") return obj.text;

  // OpenAI chat: choices[].delta.content[]
  const choices = obj?.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const c = choices[0]?.delta ?? choices[0];
    const t = pickFromContentArray(c?.content);
    if (t) return t;
  }

  // Our unified { delta: { content: [...] } }
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

// Optional: default export alias (harmless if unused)
export default streamChat;
