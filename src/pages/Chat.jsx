// src/services/chat.ts
// Minimal streaming client for the Worker endpoint.

export interface ChatRequestPayload {
  model?: string;        // server defaults to gpt-4o-mini in Stage 3
  system?: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
  tools?: unknown[];     // reserved for future MCP/tool use
}

/**
 * Stream plain-text chunks from the Worker. Returns an async generator.
 */
export async function* streamText(
  endpoint: string,
  payload: ChatRequestPayload,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
    // credentials not required here; Chat page auth is already checked via /api/me
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Chat stream error: ${res.status} ${res.statusText} ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
