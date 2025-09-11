// /worker/handlers/email.ts

try { console.log("🐛 [email] module loaded"); } catch {}


// CORS is applied at the router layer via withCORS

/**
 * Clear download_email cookie using BOTH host-only and Domain= variants.
 * This guarantees removal no matter how it was originally set.
 */
export function clearDownloadEmailCookie(): Response {
  const expires = new Date(0).toUTCString();

  const hostOnly = [
    'download_email=',
    'Path=/',
    `Expires=${expires}`,
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');

  const withDomain = [
    'download_email=',
    'Path=/',
    `Expires=${expires}`,
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Domain=chrisbrighouse.com',
  ].join('; ');

  console.log('[🐛 DBG][WK] matched /api/email/clear → clearing cookie (both variants)');

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', hostOnly);
  headers.append('Set-Cookie', withDomain);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}



// Minimal helpers to set email cookie (host + apex) using the current site cookie name.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSecure(req: Request): boolean {
  try { return new URL(req.url).protocol === 'https:'; } catch { return true; }
}
function apexFromHost(hostname: string): string | null {
  if (!hostname || hostname === 'localhost' || /^[0-9.]+$/.test(hostname)) return null;
  if (hostname.endsWith('.workers.dev')) return null;
  if (hostname.startsWith('www.')) return hostname.slice(4);
  const parts = hostname.split('.');
  if (parts.length >= 3) return parts.slice(-2).join('.');
  return hostname;
}
function buildCookie(name: string, value: string, opts: { domain?: string; secure?: boolean; expire?: boolean } = {}) {
  const parts = [ `${name}=${encodeURIComponent(value)}` ];
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  parts.push('Path=/');
  parts.push('SameSite=Lax');
  if (opts.secure) parts.push('Secure');
  if (opts.expire) {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  } else {
    parts.push(`Max-Age=${60 * 60 * 24 * 365}`);
  }
  return parts.join('; ');
}

export async function setDownloadEmailCookie(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({} as any));
    const email = String(body?.email || '').trim();
    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    const host = new URL(req.url).hostname;
    const apex = apexFromHost(host);
    const secure = isSecure(req);

    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
    // Primary cookie name used by the app
    const NAME = 'download_email';
    // Host-scoped
    headers.append('Set-Cookie', buildCookie(NAME, email, { secure }));
    // Apex-scoped
    if (apex) headers.append('Set-Cookie', buildCookie(NAME, email, { secure, domain: apex }));

    return new Response(JSON.stringify({ ok: true, email }), { status: 200, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'email_set_failed' }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
