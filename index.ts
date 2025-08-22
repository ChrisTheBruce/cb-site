// index.ts — Worker entry (merged: static SPA + robust notify-download API)
// - Serves Vite build via ASSETS (with manifest)
// - Bulletproof /api/notify-download handler (MailChannels default, optional Resend)
// - Preserves your original HTML template and CSP

interface Env {
  // Assets binding provided by wrangler.json -> assets.binding = "ASSETS"
  ASSETS?: Fetcher;

  // Email config
  EMAIL_PROVIDER?: string; // "mailchannels" (default) or "resend"
  SUPPORT_TO_EMAIL?: string; // e.g. support@chrisbrighouse.com
  SENDER_EMAIL?: string;     // e.g. no-reply@chrisbrighouse.com
  SENDER_NAME?: string;      // e.g. "Downloads"
  RESEND_API_KEY?: string;   // secret if provider === "resend"

  // Optional CORS override
  CORS_ORIGIN?: string;
}

type ManifestEntry = {
  file: string;
  css?: string[];
  isEntry?: boolean;
};

type Manifest = Record<string, ManifestEntry>;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Serve actual static assets from /dist with long cache
    if (/\.(css|js|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|txt|map)$/i.test(pathname)) {
      if (env.ASSETS?.fetch) return env.ASSETS.fetch(request);
      return new Response('Assets binding missing', { status: 500 });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env, url.origin) });
    }

    // ---- API: notify-download (accept common variants) ----
    const isNotify =
      (pathname === '/api/notify-download' ||
       pathname === '/api/notify_download' ||
       pathname === '/api/notify-downloads' ||
       pathname === '/api/notify_downloads') &&
      request.method === 'POST';

    if (isNotify) {
      try {
        let payload: any;
        try { payload = await request.json(); } catch { return j({ error: 'bad_json' }, 400, env, url.origin); }

        const userEmail = String(payload?.userEmail ?? '').trim();
        const file = String(payload?.file ?? '').trim();
        if (!isEmail(userEmail) || !file) return j({ error: 'invalid_input' }, 400, env, url.origin);

        const provider = (env.EMAIL_PROVIDER ?? 'mailchannels').toLowerCase();
        const toEmail = env.SUPPORT_TO_EMAIL;
        const fromEmail = env.SENDER_EMAIL;
        const fromName = env.SENDER_NAME ?? 'Downloads';

        const missing: string[] = [];
        if (!toEmail) missing.push('SUPPORT_TO_EMAIL');
        if (!fromEmail) missing.push('SENDER_EMAIL');
        if (missing.length) return j({ error: 'missing_vars', vars: missing }, 500, env, url.origin);

        if (provider === 'mailchannels') {
          const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: toEmail }] }],
              from: { email: fromEmail, name: fromName },
              reply_to: { email: userEmail },
              subject: `Download: ${file}`,
              content: [{ type: 'text/plain', value: `User ${userEmail} downloaded ${file} from ${url.origin}.` }]
            })
          });

          const bodyText = await res.text(); // may be empty (202)
          console.log('mailchannels status', res.status, (bodyText || '').slice(0, 300));

          if (res.status !== 202 && !res.ok) {
            return j({ error: 'email_failed', provider: 'mailchannels', status: res.status, body: clip(bodyText) }, 502, env, url.origin);
          }
          return j({ ok: true }, 200, env, url.origin);
        }

        if (provider === 'resend') {
          if (!env.RESEND_API_KEY) return j({ error: 'missing_secret', secret: 'RESEND_API_KEY' }, 500, env, url.origin);
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: [toEmail!],
              reply_to: userEmail,
              subject: `Download: ${file}`,
              text: `User ${userEmail} downloaded ${file} from ${url.origin}.`
            })
          });
          const txt = await r.text();
          console.log('resend status', r.status, txt.slice(0, 300));
          if (!r.ok) return j({ error: 'email_failed', provider: 'resend', status: r.status, body: clip(txt) }, 502, env, url.origin);
          return j({ ok: true }, 200, env, url.origin);
        }

        return j({ error: 'unknown_provider', provider }, 500, env, url.origin);
      } catch (e: any) {
        console.error('notify-download unhandled', e?.stack || String(e));
        return j({ error: 'unhandled' }, 500, env, url.origin);
      }
    }

    // ---- HTML shell for SPA (preserves your original template) ----
    // Load Vite manifest from assets to find the entry file
    if (request.method === 'GET') {
      if (!env.ASSETS?.fetch) return new Response('Assets binding missing', { status: 500 });

      const manifestReq = new Request(new URL('/.vite/manifest.json', url), request);
      const manRes = await env.ASSETS.fetch(manifestReq);
      if (!manRes.ok) return new Response('Manifest not found.', { status: 500 });

      let manifest: Manifest;
      try { manifest = await manRes.json(); } catch { return new Response('Bad manifest JSON.', { status: 500 }) }

      const entries = Object.values(manifest);
      const entry = entries.find((e) => (e as any).isEntry) || entries[0];
      if (!entry?.file) return new Response('Build manifest missing entry.', { status: 500 });

      const scriptPath = `/${entry.file}`;
      const cssTags = (entry.css || []).map((c) => `<link rel="stylesheet" href="/${c}">`).join('');

      // Your original HTML
      let html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chris Brighouse — Products for Engineering Projects & Operations</title>
  <meta name="description" content="Azure-native applications with AI features for engineering operations.">
  <link rel="canonical" href="https://chrisbrighouse.com/" />
  <meta property="og:title" content="Chris Brighouse — Product & Platform" />
  <meta property="og:description" content="Building fast, maintainable apps for engineering operations." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://chrisbrighouse.com/" />
  <meta name="theme-color" content="#ffffff">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
</head>
  <body>
    <div id="root"></div>
    <script type="module" src="${scriptPath}"></script>
  </body>
</html>`;

      // Inject CSS tags just before </head> if present
      if (cssTags) html = html.replace('</head>', `${cssTags}\n</head>`);

      const headers = new Headers({
        'content-type': 'text/html; charset=utf-8',
        'cache-control':