// /worker/handlers/notify.ts
// Logs download events to Durable Object; no outbound email.
type Env = {
  DOWNLOAD_LOG?: DurableObjectNamespace;
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://chrisbrighouse.com',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'X-App-Handler': 'worker',
  } as const;
}

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  const c = corsHeaders();
  Object.entries(c).forEach(([k, v]) => headers.set(k, v));
  return new Response(JSON.stringify(body), { ...init, headers });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleDownloadNotify(req: Request, env: Env): Promise<Response> {
  let payload: any = null;
  try {
    payload = await req.json();
  } catch (e) {
    console.log('[🐛 DBG][WK notify] invalid JSON', String(e));
    return json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const { path, title, email, ts, ua } = payload || {};
  console.log('[🐛 DBG][WK notify] payload', { path, title, email, ts, ua });

  // Basic validation
  if (!path || !email || !EMAIL_RE.test(String(email))) {
    console.log('[🐛 DBG][WK notify] validation failed', { path, email });
    return json({ ok: false, error: 'missing/invalid path or email' }, { status: 400 });
  }

  // Append to Durable Object
  try {
    const ns = env.DOWNLOAD_LOG;
    if (!ns) {
      console.log('[🐛 DBG][WK notify] DOWNLOAD_LOG binding missing');
      return json({ ok: false, error: 'storage unavailable' }, { status: 500 });
    }

    const id = ns.idFromName('global-downloads');
    const stub = ns.get(id);

    const ip = (req.headers.get('cf-connecting-ip') || '').trim() || undefined;
    const referer = req.headers.get('referer') || undefined;

    const doRes = await stub.fetch('https://do.local/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, title, email, ts, ua, ip, referer }),
    });

    if (!doRes.ok) {
      const text = await doRes.text().catch(() => '');
      console.log('[🐛 DBG][WK notify] DO append failed', doRes.status, text.slice(0, 200));
      return json({ ok: false, error: 'store failed' }, { status: 502 });
    }
  } catch (e: any) {
    console.log('[🐛 DBG][WK notify] DO append error', e?.message || String(e));
    return json({ ok: false, error: 'store error' }, { status: 502 });
  }

  return json({ ok: true, stored: true });
}
