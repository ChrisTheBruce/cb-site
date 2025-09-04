export interface Env {
  ASSETS: Fetcher;              // Vite build (wrangler assets binding)
  AUTH_SECRET: string;          // wrangler secret
  FROM_ADDRESS?: string;        // optional override, default used if missing
  SUPPORT_EMAIL?: string;       // optional override, default used if missing
  DEBUG_MODE?: string;          // optional override, default used if missing 
}
