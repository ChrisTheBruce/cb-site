import type { Env } from "./env";
import { json, bad } from "./lib/responses";
import { handleEmailSet, handleEmailClear } from "./handlers/email";
import { handleDownloadNotify } from "./handlers/notify";
import { handleLogin, handleLogout, handleMe } from "./handlers/auth";
import { handleHealth } from "./handlers/health";

export async function handleApi(request: Request, env: Env, rid: string): Promise<Response> {
  const url = new URL(request.url);
  const p = url.pathname;

  if (p === "/api/health") return handleHealth();

  // Email gate
  if (p === "/api/email" || p === "/api/email/set") return handleEmailSet(request, env, rid);
  if (p === "/api/email/clear") return handleEmailClear(request, env, rid);

  // Download notify (both routes supported)
  if (p === "/api/download/notify" || p === "/api/notify_download") return handleDownloadNotify(request, env, rid);

  // Auth
  if (p === "/api/login") return handleLogin(request, env, rid);
  if (p === "/api/logout") return handleLogout(request, env, rid);
  if (p === "/api/me") return handleMe(request, env, rid);

  return bad(404, "Not found", rid);
}
