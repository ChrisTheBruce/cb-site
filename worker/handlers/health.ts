import { json } from "../lib/responses";

// Optional diagnostics: /api/health?diag=1 will include binding presence
export function handleHealth(env?: any, req?: Request) {
  try {
    const url = req ? new URL(req.url) : null;
    const diag = url?.searchParams.get("diag") === "1";
    const base: any = { ok: true, ts: Date.now() };
    if (diag) {
      base.diag = {
        has_do: Boolean(env?.DOWNLOAD_LOG),
        debug_mode: String(env?.DEBUG_MODE ?? "") || undefined,
        host: req?.headers.get("host") || undefined,
      };
    }
    return json(base);
  } catch {
    return json({ ok: true, ts: Date.now() });
  }
}
