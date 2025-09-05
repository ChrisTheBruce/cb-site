// /worker/handlers/notify.ts
type Env = {
  SUPPORT_TO?: string;          // e.g., "support@chrisbrighouse.com"
  MAILCHANNELS_FROM?: string;   // e.g., "noreply@chrisbrighouse.com"
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

  // Build the message
  const to = env.SUPPORT_TO || 'support@chrisbrighouse.com';
  const from = env.MAILCHANNELS_FROM || 'noreply@chrisbrighouse.com';

  const subject = `Download: ${title || path} by ${email}`;
  const text =
`A download was requested.

File:    ${title || path}
Path:    ${path}
Email:   ${email}
Time:    ${ts ? new Date(ts).toISOString() : new Date().toISOString()}
UA:      ${ua || 'n/a'}
`;

  // Attempt MailChannels send
  const mcUrl = 'https://api.mailchannels.net/tx/v1/send';
  const mcReq = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: 'Downloads' },
    subject,
    content: [
      { type: 'text/plain', value: text },
    ],
  };

  console.log('[🐛 DBG][WK notify] sending via MailChannels', { to, from, subject });

  let status = 0;
  let body = '';
  try {
    const res = await fetch(mcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcReq),
      // Abort after ~8s to avoid hangs
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });
    status = res.status;
    body = await res.text();
    console.log('[🐛 DBG][WK notify] MailChannels response', { status, body: body.slice(0, 300) });
  } catch (err: any) {
    console.log('[🐛 DBG][WK notify] MailChannels fetch error', err?.message || String(err));
    return json({ ok: false, error: 'mail send failed (fetch error)' }, { status: 502 });
  }

  if (status >= 200 && status < 300) {
    return json({ ok: true, sent: true });
  } else {
    // Return ok=false but include response details for debugging
    return json({ ok: false, sent: false, status, body: body.slice(0, 500) }, { status: 502 });
  }
}
