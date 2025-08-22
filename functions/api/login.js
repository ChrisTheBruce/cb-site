import { createToken, setSessionCookie } from "../_utils/session";

export const onRequestPost = async ({ request, env }) => {
  try {
    const { username, password } = await request.json();
    // SUPER SIMPLE: single user from secrets.
    // For multiple users, we can move to KV/D1 with hashed passwords later.
    const ok = username === env.AUTH_USERNAME && password === env.AUTH_PASSWORD;
    // Small delay to reduce timing signal
    await new Promise(r => setTimeout(r, 200));

    if (!ok) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401, headers: { "content-type": "application/json" }
      });
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
    const token = await createToken(env.SESSION_SECRET, { u: username, exp });

    const headers = new Headers({ "content-type": "application/json" });
    headers.append("Set-Cookie", setSessionCookie(token));
    return new Response(JSON.stringify({ ok: true, username }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400, headers: { "content-type": "application/json" }
    });
  }
};
