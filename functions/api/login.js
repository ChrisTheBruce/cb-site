export const onRequestPost = async ({ request, env }) => {
  /** @type {{ username?: string, password?: string }} */
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;

  if (username !== "chris" || password !== "badcommand") {
    return json(401, { error: "Invalid username or password." });
  }

  const payload = { u: "chris", iat: Date.now() };
  const token = await sign(payload, env.AUTH_SECRET);

  const res = json(200, { ok: true });
  setCookie(res.headers, "chat_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
};

// ---- helpers ----
function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function setCookie(headers, name, value, opts = {}) {
  const parts = [`${name}=${value}`];
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure) parts.push(`Secure`);
  if (opts.httpOnly) parts.push(`HttpOnly`);
  headers.append("Set-Cookie", parts.join("; "));
}
async function sign(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const body = btoaUrl(JSON.stringify(data));
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const sig = toB64Url(new Uint8Array(mac));
  return `${body}.${sig}`;
}
function btoaUrl(s) { return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function toB64Url(buf) {
  let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
