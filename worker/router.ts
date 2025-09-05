// worker/router.ts
import type { Env } from './env';
import { json } from './lib/responses';
import { DBG } from './env'; // <- adjust path if DBG is elsewhere

import * as Health from './handlers/health';
import * as Auth from './handlers/auth';
import * as Notify from './handlers/notify';
import * as Chat from './handlers/chat';

// Local helpers (avoid dependency on notFound/methodNotAllowed in lib)
function notFound(msg = 'Not found') {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

function methodNotAllowed(allow: string[]) {
  return new Response(JSON.stringify({ ok: false, error: 'Method Not Allowed', allow }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      'Allow': allow.join(', '),
    },
  });
}

// Resolve handler function from namespace imports
function pickHandler(ns: Record<string, any>, candidates: string[]) {
  for (const name of candidates) {
    const fn = ns?.[name];
    if (typeof fn === 'function') return fn;
  }
  return undefined;
}

const handleHealth = pickHandler(Health, ['handleHealth', 'default']);
const handleAuthLogin = pickHandler(Auth, ['handleAuthLogin', 'login', 'default']);
const handleNotify = pickHandler(Notify, ['handleNotify', 'notify', 'default']);
const handleChatStream = pickHandler(Chat, ['handleChatStream', 'handleChat', 'chat', 'default']);

type Handler = (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;

const routes: Record<string, Record<string, Handler | undefined>> = {
  '/api/health':      { GET: handleHealth },
  '/api/auth/login':  { POST: handleAuthLogin },
  '/api/notify':      { POST: handleNotify },
  '/api/chat/stream': { POST: handleChatStream },
};

function normPath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

export async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = normPath(url.pathname);
  const method = request.method.toUpperCase();

  DBG('router:incoming', { method, path });

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
    DBG('router:error', {
      method,
      path,
      message: err?.message || String(err),
      stack: err?.stack?.slice?.(0, 800),
    });
    return json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
