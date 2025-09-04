export interface Env {
  ASSETS: Fetcher;              // Vite build (wrangler assets binding)
  AUTH_SECRET: string;          // wrangler secret
  FROM_ADDRESS?: string;        // optional override, default used if missing
  SUPPORT_EMAIL?: string;       // optional override, default used if missing
  DEBUG_MODE?: string;          // optional override, default used if missing 
}

export function isDebug(env: { DEBUG_MODE?: string }): boolean {
  return env.DEBUG_MODE === "true";
}

/*
export function DBG(env: { DEBUG_MODE?: unknown }, ...args: any[]): void {
  if (isDebug(env)) {
    console.log("🐛 DBG:", ...args);
  }
*/
export function DBG( ...args: any[]): void {
  if (isDebug(env)) {
    console.log( "🐛 ", ...args);
  }

}


