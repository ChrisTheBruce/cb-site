// worker/env.ts

// Keep your Env shape minimal but extensible
export type Env = {
  DEBUG_MODE?: string | boolean;
  ASSETS: Fetcher;              // Vite build (wrangler assets binding)
  AUTH_SECRET: string;          // wrangler secret
  FROM_ADDRESS?: string;        // optional override, default used if missing
  SUPPORT_EMAIL?: string;       // optional override, default used if missing
  OPENAI_API?: string;
  OPENAI_BASE?: string;
  AI_GATEWAY_URL?: string;
  // add any other bindings you use (KV, R2, MailChannels, etc.)
  // DOWNLOADS_KV?: KVNamespace;
};

// ---- Debug controls ---------------------------------------------------------

let _debugEnabled = false;

/** Returns true if DEBUG_MODE in the Worker bindings is truthy. */
export function isDebug(env: Env): boolean {
  const v = env?.DEBUG_MODE;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  }
  return Boolean(v);
}

/**
 * Call this once at the start of handling a request to prime the debug flag.
 * This avoids passing `env` into every DBG() call.
 */
export function setDBGEnv(env: Env): void {
  _debugEnabled = isDebug(env);
}

/** Simple debug logger that does NOT reference `env`. */
export function DBG(msg: string, meta?: unknown): void {
  console.log(`[🐛DBG] in DBG function`);
  if (!_debugEnabled) return;
  // Keep the format compact but structured for tail/JSON grep
  if (meta !== undefined) {
    console.log(`[🐛DBG] ${msg}`, meta);
  } else {
    console.log(`[🐛DBG] ${msg}`);
  }
}
