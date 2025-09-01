import type { Env } from "../env";
import { json, bad } from "../lib/responses";
import { isAllowedMethod, requireOrigin, EMAIL_RE } from "../lib/security";
import { parseCookies } from "../lib/cookies";
import { rateLimit } from "../lib/rateLimit";
import { sendSupportEmail } from "../lib/mail";

const ALLOW_RE: RegExp[] = [
  /^\/downloads\//i,
  /^\/assets\/downloads\//i,
  /^\/assets\//i,
  /^\/files\//i,
  /^\/static\//i,
];

function pathAllowed(pathname: string) {
  return ALLOW_RE.some(rx => rx.test(pathname));
}

function coerceFilePath(urlStr: string, base: string) {
  try {
    const u = new URL(urlStr, base);
    let p = u.pathname;
    if (!p.startsWith("/")) p = "/" + p;
    return p;
  } catch {
    return "";
  }
}

export async function handleDownloadNotify(request: Request, env: Env, rid: string) {
  if (!isAllowedMethod(request, ["POST"])) return bad(405, "Method not allowed", rid);
  if (!requireOrigin(request)) return bad(403, "Forbidden (origin)", rid);

  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const ua = request.headers.get("user-agent") || "";
  const base = new URL(request.url).origin;

  const rate = await rateLimit(request, `dlnotify:${ip}`, 20, 60);
  if (!rate.ok) return bad(429, `Too many requests. Retry after ${rate.reset}`, rid);

  const body = await request.json().catch(() => ({} as any));
  const candidate = body.filePath || body.path || body.url || body.href || "";
  const title = body.title || body.name || "";

  if (!candidate || typeof candidate !== "string") {
    return bad(400, "Missing filePath/path/url in body", rid, { receivedKeys: Object.keys(body || {}) });
  }

  const pathname = coerceFilePath(candidate, base);
  if (!pathname) return bad(400, "Invalid file path or URL", rid, { candidate });
  if (!pathAllowed(pathname)) return bad(400, "Disallowed file path (adjust allowlist)", rid, { pathname });

  const cookies = parseCookies(request);
  const dlEmail = cookies["dl_email"] ? decodeURIComponent(cookies["dl_email"]) : "";
  if (!dlEmail || !EMAIL_RE.test(dlEmail)) return bad(401, "Missing or invalid dl_email cookie", rid);

  const nowISO = new Date().toISOString();
  const subject = `Download: ${title || pathname}`;
  const bodyText = [
    `A file was downloaded.`,
    `Time: ${nowISO}`,
    `User email: ${dlEmail}`,
    `File: ${pathname}`,
    title ? `Title: ${title}` : null,
    `IP: ${ip}`,
    `UA: ${ua}`,
    `RID: ${rid}`,
  ].filter(Boolean).join("\n");

  // Soft-fail so downloads never break:
  try {
    await sendSupportEmail(env, subject, bodyText);
    return json({ ok: true, rid, rate });
  } catch (err: any) {
    console.error(JSON.stringify({ level: "error", rid, msg: "Mail send failed", error: err?.message || String(err) }));
    return json({ ok: true, rid, rate, warn: "mail_notify_failed" });
  }
}
