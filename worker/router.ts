// worker/router.ts
import { json, notFound, methodNotAllowed } from './lib/responses';
import { handleHealth } from './handlers/health';
import { handleAuthLogin } from './handlers/auth';
import { handleNotify } from './handlers/notify';
import { handleChatStream } from './handlers/chat';
import type { Env } from './env';

// 👉 If your DBG utility lives elsewhere, update this import.
import { DBG } from './env';

type Handler = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;

// Central, explicit route table
const routes: Record<string, Record<string, Handler>> = {
  '/api/health':      { GET: handleHealth },
  '/api/auth/login':  { POST: handleAuthLogin },
  '/api/notify':      { POST: handleNotify },
  '/api/chat/stream': { POST: handleChatStream },
};

// Normalize URL path (strip trailing slash except root)
function normPath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

export async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = normPath(url.pathname);
  const method = request.method.toUpperCase();

  // ── trace: entry ───────────────────────────────────────────────────────────────
  DBG('router:incoming', { method, path });

  // Fast-exit: only handle /api/* here; let index.ts serve SPA/static for the rest
  if (!path.startsWith('/api/')) {
    DBG('router:nonApi', { path });
    return notFound('Not an API route');
  }

  const table = routes[path];

  if (!table) {
    DBG('router:noRoute', { method, path });
    return notFound(`No route for ${path}`);
  }

  const handler = table[method];
  if (!handler) {
    DBG('router:methodNotAllowed', { method, path, allow: Object.keys(table) });
    return methodNotAllowed(Object.keys(table));
  }

  try {
    DBG('router:dispatch', { method, path });
    const t0 = Date.now();
    const res = await handler(request, env, ctx);
    const ms = Date.now() - t0;

    DBG('router:handled', {
      method,
      path,
      status: (res as any)?.status ?? 200,
      ms,
    });

    return res;
  } catch (err: any) {
    // Centralized error guard: never leak internals
    DBG('router:error', {
      method,
      path,
      message: err?.message || String(err),
      stack: err?.stack?.slice?.(0, 800),
    });
    return json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
