// /worker/router.ts
import { Router } from 'itty-router';

// ---- CORS (adjust origin(s) if needed)
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://chrisbrighouse.com',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
  'X-App-Handler': 'worker',
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) },
  });

// ---- Router
export const router = Router();

// ---- Diagnostics (kept)
router.get('/api/__whoami', () =>
  json({ ok: true, stack: 'worker', ts: Date.now() }, { status: 200 })
);

// ---- CORS preflight (kept)
router.options('/api/*', () => new Response(null, { headers: corsHeaders }));

// ---- Email routes (kept)
import * as email from './handlers/email';
router.post('/api/email/clear', email.clearCookie);

// ---- Auth routes (NEW)
import * as auth from './handlers/auth';

// POST /api/auth/login   -> sets signed session cookie
router.post('/api/auth/login', (request: Request, env: any) =>
  auth.login({ req: request, env })
);

// GET /api/auth/me       -> returns { ok:true, user:{...} } if logged in
router.get('/api/auth/me', (request: Request, env: any) =>
  auth.me({ req: request, env })
);

// POST /api/auth/logout  -> clears session cookie
router.post('/api/auth/logout', (request: Request, env: any) =>
  auth.logout({ req: request, env })
);

// ---- 404 fallback (kept)
router.all('*', (req: Request) => {
  const p = new URL(req.url).pathname;
  return json({ ok: false, error: `No route for ${p}` }, { status: 404 });
});

/*
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
*/