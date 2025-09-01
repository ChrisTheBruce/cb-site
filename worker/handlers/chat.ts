// worker/handlers/chat.ts
// OpenAI streaming handler for Cloudflare Workers

type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

interface ChatEnv {
  OPENAI_API?: string; // Cloudflare secret
}

// --- Public: OpenAI streaming ---
export async function chatStreamOpenAI(request: Request, env?: ChatEnv): Promise<Response> {
  // Defaults
  let messages: Msg[] = [];
  let model = "gpt-4o-mini";
  let temperature: number | undefined;

  // Parse JSON body safely
  try {
    const body = await request.json();
    if (Array.isArray(body?.messages)) messages = body.messages as Msg[];
    if (typeof body?.model === "string" && body.model.trim()) model = body.model.trim();
    if (typeof body?.temperature === "number") temperature = body.temperature;
  } catch {
    // ignore and use defaults
  }

  const apiKey = env?.OPENAI_API;
  if (!apiKey) {
    return new Response("OPENAI_API not configured", {
      status: 500,
      headers: corsTextHeaders(),
    });
  }

  // Trim history to a sane window (avoid huge payloads)
  const trimmed = messages.slice(-40).map((m) => ({ role: m.role, content: m.content }));

  const payload = {
    model,
    messages: trimmed,
    stream: true,
    ...(temperature !== undefined ? { temperature } : {}),
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let upstream: Response | null = null;

      try {
        upstream = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          controller.enqueue(encoder.encode(`[OpenAI ${upstream.status}] ${text}`));
          controller.close();
          return;
        }

        // Parse SSE and forward only delta.content as plaintext
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Optional: tag first chunk so you can prove this handler ran
        let first = true;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);

            if (!line) continue;
            if (!line.startsWith("data:")) continue;

            const data = line.slice(5).trim(); // after "data:"
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                if (first) {
                  // one-time marker header in-body (comment out if you don’t want it)
                  // controller.enqueue(encoder.encode("[OPENAI] "));
                  first = false;
                }
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }
      } catch (err: any) {
        controller.enqueue(encoder.encode(`\n[Stream error] ${err?.message ?? ""}\n`));
      } finally {
        controller.close();
      }
    },
  });

  const res = new Response(stream, {
    status: 200,
    headers: {
      ...corsTextHeaders(),
      "X-Chat-Handler": "openai",
    },
  });

  return res;
}

// --- Legacy name kept for safety: route still gets OpenAI even if importing the echo name ---
export async function chatStreamEcho(request: Request, env?: ChatEnv): Promise<Response> {
  return chatStreamOpenAI(request, env);
}

// ----- helpers -----
function corsTextHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };
}
