import type { Env } from "../env";
import { json, bad } from "../lib/responses";
import { isAllowedMethod, requireOrigin, EMAIL_RE, normEmail } from "../lib/security";
import { serializeCookie } from "../lib/cookies";

export async function handleEmailSet(request: Request, _env: Env, rid: string) {
  if (!isAllowedMethod(request, ["POST"])) return bad(405, "Method not allowed", rid);
  if (!requireOrigin(request)) return bad(403, "Forbidden (origin)", rid);

  const { email } = await request.json().catch(() => ({} as any));
  if (!email || !EMAIL_RE.test(email)) return bad(400, "Invalid email", rid);

  const value = encodeURIComponent(normEmail(email));
  const cookie = serializeCookie("dl_email", value, {
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return new Response(JSON.stringify({ ok: true, email: decodeURIComponent(value), rid }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": cookie },
  });
}

export async function handleEmailClear(_request: Request, _env: Env, rid: string) {
  const cookie = serializeCookie("dl_email", "", {
    maxAge: 0,
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
    path: "/",
  });
  return new Response(JSON.stringify({ ok: true, rid }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": cookie },
  });
}
