export const onRequestPost = async () => {
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("Set-Cookie", "session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
