// worker/handlers/chat.ts
// Stage 1: streaming echo stub (no OpenAI yet)

export async function chatStreamEcho(request: Request): Promise<Response> {
  let lastUser = "";
  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    lastUser =
      [...messages].reverse().find((m: any) => m && m.role === "user")?.content ?? "";
  } catch {
    // ignore; we'll just echo "(no input)"
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const tokens = (`Echo: ${lastUser || "(no input)"}`).split(/\s+/);
      for (const t of tokens) {
        controller.enqueue(encoder.encode(t + " "));
        await new Promise((r) => setTimeout(r, 35)); // tiny delay to visualize streaming
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // CORS: mirror your existing API behavior; if you set CORS globally via router, you can drop this.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
