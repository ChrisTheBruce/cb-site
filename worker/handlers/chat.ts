// worker/handlers/chat.ts
type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };
interface ChatEnv { OPENAI_API?: string }

function corsTextHeaders(): Record<string, string> {
  // match your site origin; tweak if you prefer "*"
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "https://chrisbrighouse.com",
  };
}

// === Public: OpenAI streaming ===
export async function chatStreamOpenAI(request: Request, env?: ChatEnv): Promise<Response> {
  let messages: Msg[] = [];
  let model = "gpt-4o-mini";
  let temperature: number | undefined;

  try {
    const body = await request.json();
    if (Array.isArray(body?.messages)) messages = body.messages as Msg[];
    if (typeof body?.model === "string" && body.model.trim()) model = body.model.trim();
    if (typeof body?.temperature === "number") temperature = body.temperature;
  } catch { /* defaults */ }

  const apiKey = env?.OPENAI_API;
  if (!apiKey) {
    return new Response("OPENAI_API not configured", { status: 500, headers: corsTextHeaders() });
  }

  const payload: any = { model, stream: true, messages: messages.slice(-40), ...(temperature !== undefined ? { temperature } : {}) };

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          controller.enqueue(enc.encode(`[OpenAI ${upstream.status}] ${text}`));
          controller.close();
          return;
        }

        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let first = true;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);

            if (!line || !line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") { controller.close(); return; }

            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                if (first) { /* marker to prove OpenAI path */
                  controller.enqueue(enc.encode("[OPENAI] "));
                  first = false;
                }
                controller.enqueue(enc.encode(delta));
              }
            } catch { /* ignore */ }
          }
        }
      } catch (e: any) {
        controller.enqueue(enc.encode(`\n[Stream error] ${e?.message ?? ""}\n`));
      } finally {
        controller.close();
      }
    },
  });

  const res = new Response(stream, { status: 200, headers: { ...corsTextHeaders(), "X-Chat-Handler": "openai" } });
  return res;
}

// === Safety alias: even if the router imports the old name, you'll still get OpenAI ===
export async function chatStreamEcho(request: Request, env?: ChatEnv): Promise<Response> {
  return chatStreamOpenAI(request, env);
}
