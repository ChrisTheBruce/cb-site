import { getCookie, readToken } from "../../server/auth/session";

export const onRequestGet = async ({ request, env }) => {
  const token = getCookie(request, "session");
  const payload = await readToken(env.SESSION_SECRET, token);
  if (!payload) return new Response(null, { status: 401 });
  return Response.json({ username: payload.u });
};
