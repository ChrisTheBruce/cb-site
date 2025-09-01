// worker/handlers/chat.ts

// --- Stage 1: streaming echo (works without any external deps) ---
export async function chatStreamEcho(request: Request): Promise<Response> {
  let lastUser = "";
  try {
    const body = await request.json();
    const msgs = Array.isArray(body?.messages) ? body.messages : [];
    lastUser =
      [...msgs].reverse().find((m: any) => m && m.role === "user")?.content ?? "";
  } catch {
    // ignore bad/missing JSON
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const tokens = (`Echo: ${lastUser || "(no input)"}`).split(/\s+/);
      for (const t of tokens) {
        controller.enqueue(enc.encode(t + " "));
        await new Promise((r) => setTimeout(r, 35));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// --- Stage 3 (optional): OpenAI streaming. Wire it in router when ready. ---
type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };
interface ChatEnv { OPENAI_API?: string }

export async function chatStreamOpenAI(request: Request, env?: ChatEnv): Promise<Response> {
  let messages: Msg[] = [];
  let model = "gpt-4o-mini";
  let temperature: number | undefined;

  try {
    const body = await request.json();
    if (Array.isArray(body?.messages)) messages = body.messages;
    if (typeof body?.model === "string") model = body.model;
    if (typeof body?.temperature === "number") temperature = body.temperature;
  } catch {
    // fall back to defaults
  }

  const apiKey = env?.OPENAI_API;
  if (!apiKey) return new Response("OPENAI_API not configured", { status: 500 });

  const payload = {
    model,
    stream: true,
    temperature,
    messages: messages.map(m => ({ role: m.role, content: m.content })).slice(-40),
  };

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok || !resp.body) {
        const text = await resp.text().catch(() => "");
        controller.enqueue(enc.encode(`[OpenAI error ${resp.status}] ${text}`));
        controller.close();
        return;
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const json = JSON.parse(data);
                const delta = json?.choices?.[0]?.delta?.content ?? "";
                if (delta) controller.enqueue(enc.encode(delta));
              } catch {
                // ignore malformed chunk
              }
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
