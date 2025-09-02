// worker/handlers/chat.ts
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

const DEFAULT_MODEL = 'gpt-4o';

interface Env {
  OPENAI_API: string;     // Cloudflare secret
  OPENAI_BASE?: string;   // optional var in wrangler.jsonc
}

export async function chat(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: any = null;
  try { body = await req.json(); } catch { /* ignore */ }

  const messages = Array.isArray(body?.messages) ? body.messages : null;
  const model = body?.model || DEFAULT_MODEL;
  if (!messages) {
    return new Response(JSON.stringify({ error: 'messages[] required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  const base = env.OPENAI_BASE
    || 'https://gateway.ai.cloudflare.com/v1/6809dd00f7144b0e15d82494016f4459/cb-openai';
  const upstream = `${base}/openai/chat/completions`;

  const upstreamRes = await fetch(upstream, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages, stream: true })
  });

  if (!upstreamRes.body) {
    const detail = await upstreamRes.text().catch(() => '');
    return new Response(JSON.stringify({ error: 'upstream error', detail }), {
      status: upstreamRes.status, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }

  // Transform OpenAI SSE -> raw text stream of tokens for a super-simple client
  const enc = new TextEncoder(); const dec = new TextDecoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const reader = upstreamRes.body.getReader();
  let buf = '';

  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;

          const payload = line.slice(5).trim();
          if (payload === '[DONE]') break;

          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) await writer.write(enc.encode(delta));
          } catch { /* ignore malformed */ }
        }
      }
    } finally { writer.close(); }
  })();

  return new Response(readable, {
    headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
