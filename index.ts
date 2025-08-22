// index.ts — Cloudflare Worker (full replacement)
// - Serves Vite build via ASSETS (with manifest auto-detect)
// - Robust /functions/api/notify-download handler (MailChannels default; optional Resend)
// - Preserves your HTML shell and injects built script + CSS
// - CORS on all responses; never blind 500s

interface Env {
  ASSETS?: Fetcher;                 // assets.binding = "ASSETS" in wrangler.json
  EMAIL_PROVIDER?: string;          // "mailchannels" (default) or "resend"
  SUPPORT_TO_EMAIL?: string;        // support@chrisbrighouse.com
  SENDER_EMAIL?: string;            // no-reply@chrisbrighouse.com (owned/verified)
  SENDER_NAME?: string;             // "Downloads"
  RESEND_API_KEY?: string;          // secret if EMAIL_PROVIDER=resend
  CORS_ORIGIN?: string;             // optional explicit origin for CORS
}

type ManifestEntry = { file: string; css?: string[]; isEntry?: boolean };
type Manifest = Record<string, ManifestEntry>;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, origin } = url;

    // Serve versioned assets directly (hashed files, images, fonts, sourcemaps)
    if (/\.(css|js|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|txt|map)$/i.test(pathname)) {
      if (env.ASSETS?.fetch) return env.ASSETS.fetch(request);
      return new Response('Assets binding missing', { status: 500 });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env, origin) });
    }

    // ---- API: notify-download (accept common variants to avoid typos) ----
    const isNotify = (
      pathname === '/functions/api/notify-download' ||
      pathname === '/functions/api/notify_download' ||
      pathname === '/functions/api/notify-downloads' ||
      pathname === '/functions/api/notify_downloads'
    ) && request.method === 'POST';

    if (isNotify) {
      try {
        let payload: any;
        try { payload = await request.json(); }
        catch { return j({ error: 'bad_json' }, 400, env, origin); }

        const userEmail = String(payload?.userEmail ?? '').trim();
        const file = String(payload?.file ?? '').trim();
        if (!isEmail(userEmail) || !file) return j({ error: 'invalid_input' }, 400, env, origin);

        const provider = (env.EMAIL_PROVIDER ?? 'mailchannels').toLowerCase();
        const toEmail = env.SUPPORT_TO_EMAIL;
        const fromEmail = env.SENDER_EMAIL;
        const fromName = env.SENDER_NAME ?? 'Downloads';

        const missing: string[] = [];
        if (!toEmail) missing.push('SUPPORT_TO_EMAIL');
        if (!fromEmail) missing.push('SENDER_EMAIL');
        if (missing.length) return j({ error: 'missing_vars', vars: missing }, 500, env, origin);

        if (provider === 'mailchannels') {
          const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: toEmail }] }],
              from: { email: fromEmail, name: fromName },
              reply_to: { email: userEmail },
              subject: `Download: ${file}`,
              content: [
                { type: 'text/plain', value: `User ${userEmail} downloaded ${file} from ${origin}.` }
              ]
            })
          });

          const bodyText = await res.text(); // 202 often returns empty body
          console.log('mailchannels status', res.status, (bodyText || '').slice(0, 300));

          if (res.status !== 202 && !res.ok) {
            return j({ error: 'email_failed', provider: 'mailchannels', status: res.status, body: clip(bodyText) }, 502, env, origin);
          }
          return j({ ok: true }, 200, env, origin);
        }

        if (provider === 'resend') {
          if (!env.RESEND_API_KEY) return j({ error: 'missing_secret', secret: 'RESEND_API_KEY' }, 500, env, origin);
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: [toEmail!],
              reply_to: userEmail,
              subject: `Download: ${file}`,
              text: `User ${userEmail} downloaded ${file} from ${origin}.`
            })
          });
          const txt = await r.text();
          console.log('resend status', r.status, txt.slice(0, 300));
          if (!r.ok) return j({ error: 'email_failed', provider: 'resend', status: r.status, body: clip(txt) }, 502, env, origin);
          return j({ ok: true }, 200, env, origin);
        }

        return j({ error: 'unknown_provider', provider }, 500, env, origin);
      } catch (e: any) {
        console.error('notify-download unhandled', e?.stack || String(e));
        return j({ error: 'unhandled' }, 500, env, origin);
      }
    }

    // ---- SPA shell (GET only). Preserve your HTML and inject built assets ----
    if (request.method === 'GET') {
      if (!env.ASSETS?.fetch) return new Response('Assets binding missing', { status: 500 });

      // Try standard Vite locations for the manifest
      const manifestUrls = ['/manifest.json', '/.vite/manifest.json'];
      let manifest: Manifest | null = null;
      for (const m of manifestUrls) {
        const manRes = await env.ASSETS.fetch(new Request(new URL(m, origin), request));
        if (manRes.ok) {
          try { manifest = await manRes.json(); break; } catch { /* try next */ }
        }
      }
      if (!manifest) {
        // Fall back to serving the SPA from ASSETS directly
        return env.ASSETS.fetch(request);
      }

      const entries = Object.values(manifest);
      const entry = entries.find(e => (e as any).isEntry) || entries[0];
      if (!entry?.file) return new Response('Build manifest missing entry.', { status: 500 });

      const scriptPath = `/${entry.file}`;
      const cssTags = (entry.css || []).map(c => `<link rel="stylesheet" href="/${c}">`).join('');

      // Your HTML shell (preserved structure; script src set to built entry)
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

      // Inject CSS right before </head>
      if (cssTags) html = html.replace('</head>', `${cssTags}\n</head>`);

      const headers = new Headers({
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        'content-security-policy': "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'"
      });
      return new Response(html, { status: 200, headers });
    }

    // Final fallback
    if (env.ASSETS?.fetch) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }
} satisfies ExportedHandler<Env>;

// ---- Helpers ----
function isEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
}
function clip(s: string): string { return (s || '').slice(0, 500); }
function cors(env: Env, fallbackOrigin: string): Record<string, string> {
  const origin = env.CORS_ORIGIN || fallbackOrigin;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Max-Age': '86400'
  };
}
function j(obj: unknown, status: number, env: Env, origin: string): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...cors(env, origin) }
  });
}
