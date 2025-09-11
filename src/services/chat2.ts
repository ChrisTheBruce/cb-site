export type Chat2Message = { role: "system" | "user" | "assistant"; content: string };

export type Chat2Options = {
  messages: Chat2Message[];
  onToken?: (chunk: string) => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
};

const CHAT2_PATH = "/api/chat/stream";

export async function streamChat2(opts: Chat2Options): Promise<void> {
  const { messages, onToken, onError, signal } = opts;

  try {
    const resp = await fetch(CHAT2_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ 
        messages, 
        model: "gpt-4o-mini", 
        temperature: 0.5 
      }),
      signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Chat2 ${resp.status}: ${text.slice(0, 300)}`);
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new Error("Empty response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const records = buffer.split(/\r?\n\r?\n/);
      buffer = records.pop() ?? "";

      for (const rec of records) {
        const lines = rec.split(/\r?\n/);
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          
          try {
            const j = JSON.parse(data);
            const delta = j?.choices?.[0]?.delta?.content ?? "";
            if (delta) onToken?.(delta);
          } catch {
            if (data && !data.startsWith("{")) onToken?.(data);
          }
        }
      }
    }
  } catch (err) {
    onError?.(err instanceof Error ? err.message : String(err));
  }
}
