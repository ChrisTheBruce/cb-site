// index.ts — Cloudflare Worker (hardened replacement)
// Features added:
// - Clear API route separation for /api/email/* and /api/download/notify (auth routes left intact if present elsewhere)
// - Tightened cookie handling (dl_email vs auth_session separation)
// - Lightweight IP rate limiting via caches.default (no KV needed)
// - Structured logging with request IDs
// - MailChannels integration to notify support on each download
//
// Bindings required in wrangler.toml:
// - ASSETS (static asset fetcher for Vite build)
// - AUTH_SECRET (existing; not used directly here but kept for compatibility)
// - Optional: FROM_ADDRESS (default 'no-reply@chrisbrighouse.com')
// - Optional: SUPPORT_EMAIL (default 'support@chrisbrighouse.com')
//
// Notes:
// - Keep downloads/auth strictly separate. The presence of dl_email NEVER implies authentication.
// - You may wish to replace the ALLOWLIST with your actual list of downloadable asset paths.

export interface Env {
  ASSETS: Fetcher;
  AUTH_SECRET: string;
  FROM_ADDRESS?: string;
  SUPPORT_EMAIL?: string;
}

// ---- Utilities --------------------------------------------------------------

const DEFAULT_FROM = 'no-reply@chrisbrighouse.com';
const DEFAULT_SUPPORT = 'support@chrisbrighouse.com';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function rid() {
  // simple unique id for correlating logs
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function log(level: LogLevel, rid: string, msg: string, extra?: Record<string, unknown>) {
  const record = { level, rid, msg, ...extra };
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](JSON.stringify(record));
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
}

function bad(status: number, message: string, rid: string) {
  return json({ ok: false, error: message, rid }, { status });
}

function isAllowedMethod(request: Request, methods: string[]) {
  return methods.includes(request.method.toUpperCase());
}

function requireOrigin(request: Request): boolean {
  // Basic CSRF mitigation for state-changing endpoints (same-origin checks)
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (!origin && !referer) return true; // Non-browser clients
  try {
    const r = new URL((origin || referer)!);
    const u = new URL(request.url);
    return r.host === u.host && r.protocol === u.protocol;
  } catch {
    return false;
  }
}

// ---- Cookies ---------------------------------------------------------------

type CookieOpts = {
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  maxAge?: number; // seconds
};

function serializeCookie(name: string, value: string, opts: CookieOpts = {}) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure ?? true) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  return parts.join('; ');
}

function parseCookies(request: Request): Record<string, string> {
  const raw = request.headers.get('cookie') || '';
  const out: Record<string, string> = {};
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) {
      const k = p.slice(0, i).trim();
      const v = p.slice(i + 1).trim();
      out[k] = v;
    }
  });
  return out;
}

// ---- Rate limiting (edge-cache) -------------------------------------------

async function rateLimit(request: Request, key: string, limit: number, windowSec: number): Promise<{ ok: boolean; remaining: number; reset: number; }> {
  const cache = caches.default;
  const now = Math.floor(Date.now() / 1000);
  const cacheKey = new Request(`https://ratelimit.local/${key}`);
  const hit = await cache.match(cacheKey);
  let count = 0;
  let windowStart = now;
  if (hit) {
    const data = await hit.json().catch(() => ({ count: 0, windowStart: now }));
    count = data.count || 0;
    windowStart = data.windowStart || now;
    if (now - windowStart >= windowSec) {
      // new window
      count = 0;
      windowStart = now;
    }
  }
  count += 1;
  const remaining = Math.max(0, limit - count);
  const reset = windowStart + windowSec;
  const ttl = Math.max(1, reset - now);
  const body = JSON.stringify({ count, windowStart });
  await cache.put(cacheKey, new Response(body, { headers: { 'cache-control': `max-age=${ttl}` } }));
  return { ok: count <= limit, remaining, reset };
}

// ---- Validation ------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normEmail(e: string) {
  return e.trim().toLowerCase();
}

// Allowlist your downloadable asset paths here (prefix match).
// Example: '/assets/downloads/' will allow anything under that directory.
const DOWNLOAD_ALLOWLIST = ['/downloads/', '/assets/downloads/'];

// ---- MailChannels ----------------------------------------------------------

async function sendSupportEmail(env: Env, subject: string, textBody: string) {
  const from = env.FROM_ADDRESS || DEFAULT_FROM;
  const to = env.SUPPORT_EMAIL || DEFAULT_SUPPORT;

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: 'Website Download Notifier' },
    subject,
    content: [{ type: 'text/plain', value: textBody }],
  };

  const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => 'MailChannels error');
    throw new Error(`Mail send failed: ${err}`);
  }
}

// ---- API Handlers ----------------------------------------------------------

async function handleEmailSet(request: Request, env: Env, ridStr: string) {
  if (!isAllowedMethod(request, ['POST'])) return bad(405, 'Method not allowed', ridStr);
  if (!requireOrigin(request)) return bad(403, 'Forbidden (origin)', ridStr);

  const { email } = await request.json().catch(() => ({} as any));
  if (!email || !EMAIL_RE.test(email)) return bad(400, 'Invalid email', ridStr);

  const value = encodeURIComponent(normEmail(email));
  const cookie = serializeCookie('dl_email', value, {
    httpOnly: false, // readable by client to display above title
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  });

  return new Response(JSON.stringify({ ok: true, email: decodeURIComponent(value), rid: ridStr }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': cookie },
  });
}

async function handleEmailClear(request: Request, env: Env, ridStr: string) {
  if (!isAllowedMethod(request, ['POST'])) return bad(405, 'Method not allowed', ridStr);
  if (!requireOrigin(request)) return bad(403, 'Forbidden (origin)', ridStr);
  const cookie = serializeCookie('dl_email', '', { maxAge: 0, httpOnly: false, secure: true, sameSite: 'Lax', path: '/' });
  return new Response(JSON.stringify({ ok: true, rid: ridStr }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': cookie },
  });
}

function isAllowedDownloadPath(pathname: string) {
  return DOWNLOAD_ALLOWLIST.some((prefix) => pathname.startsWith(prefix));
}

async function handleDownloadNotify(request: Request, env: Env, ridStr: string) {
  if (!isAllowedMethod(request, ['POST'])) return bad(405, 'Method not allowed', ridStr);
  if (!requireOrigin(request)) return bad(403, 'Forbidden (origin)', ridStr);

  // Rate limit per IP to avoid abuse: e.g., 10 notifications per minute
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  const rate = await rateLimit(request, `dlnotify:${ip}`, 10, 60);
  if (!rate.ok) return bad(429, `Too many requests. Retry after ${rate.reset}`, ridStr);

  const ua = request.headers.get('user-agent') || '';
  const { filePath, title } = await request.json().catch(() => ({} as any));
  if (!filePath || typeof filePath !== 'string') return bad(400, 'Missing filePath', ridStr);

  try {
    const u = new URL(filePath, new URL(request.url).origin);
    if (!isAllowedDownloadPath(u.pathname)) {
      return bad(400, 'Disallowed file path', ridStr);
    }
  } catch {
    return bad(400, 'Invalid filePath', ridStr);
  }

  const cookies = parseCookies(request);
  const dlEmail = cookies['dl_email'] ? decodeURIComponent(cookies['dl_email']) : '';
  if (!dlEmail || !EMAIL_RE.test(dlEmail)) return bad(401, 'Missing or invalid dl_email cookie', ridStr);

  const nowISO = new Date().toISOString();
  const subject = `Download: ${title || filePath}`;
  const body = [
    `A file was downloaded.`,
    `Time: ${nowISO}`,
    `User email: ${dlEmail}`,
    `File: ${filePath}`,
    title ? `Title: ${title}` : null,
    `IP: ${ip}`,
    `UA: ${ua}`,
    `RID: ${ridStr}`,
  ].filter(Boolean).join('\n');

  try {
    await sendSupportEmail(env, subject, body);
  } catch (err: any) {
    return bad(502, err.message || 'Mail send failed', ridStr);
  }

  return json({ ok: true, rid: ridStr, rate });
}

// ---- Router ----------------------------------------------------------------

async function handleApi(request: Request, env: Env, ridStr: string): Promise<Response> {
  const url = new URL(request.url);
  const p = url.pathname;

  // Health check
  if (p === '/api/health') return json({ ok: true, rid: ridStr, ts: Date.now() });

  // Email gate
  if (p === '/api/email/set') return handleEmailSet(request, env, ridStr);
  if (p === '/api/email/clear') return handleEmailClear(request, env, ridStr);

  // Download notify
  if (p === '/api/download/notify') return handleDownloadNotify(request, env, ridStr);

  // Unknown
  return bad(404, 'Not found', ridStr);
}

// ---- Main fetch ------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const ridStr = rid();
    const url = new URL(request.url);

    try {
      // Preflight for CORS (same-origin SPA usually doesn’t need this, but keep harmless)
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': url.origin,
            'access-control-allow-methods': 'GET,POST,OPTIONS',
            'access-control-allow-headers': 'content-type',
            'access-control-max-age': '86400',
          },
        });
      }

      if (url.pathname.startsWith('/api/')) {
        const res = await handleApi(request, env, ridStr);
        // Attach standard headers
        res.headers.set('x-request-id', ridStr);
        res.headers.set('cache-control', 'no-store');
        return res;
      }

      // Fall through to static assets (Vite build)
      const assetRes = await env.ASSETS.fetch(request);
      assetRes.headers.set('x-request-id', ridStr);
      return assetRes;
    } catch (err: any) {
      log('error', ridStr, 'Unhandled exception', { error: err?.message || String(err) });
      return bad(500, 'Internal error', ridStr);
    } finally {
      // Structured access log
      log('info', ridStr, 'request', {
        method: request.method,
        path: url.pathname,
        ip: request.headers.get('cf-connecting-ip') || '',
        ua: request.headers.get('user-agent') || '',
      });
    }
  },
};