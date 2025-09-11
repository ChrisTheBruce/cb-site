const enc = new TextEncoder();

function b64urlEncode(buf) {
  const bin = typeof buf === "string" ? buf : String.fromCharCode(...new Uint8Array(buf));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecodeToString(b64) {
  const pad = b64 + "===".slice((b64.length + 3) % 4);
  const s = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
  return s;
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64urlEncode(sig);
}

function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function createToken(secret, payload) {
  const data = b64urlEncode(JSON.stringify(payload));
  const sig = await hmac(data, secret);
  return `${data}.${sig}`;
}

export async function readToken(secret, token) {
  const [data, sig] = (token || "").split(".");
  if (!data || !sig) return null;
  const expect = await hmac(data, secret);
  if (!timingSafeEq(sig, expect)) return null;
  const payload = JSON.parse(b64urlDecodeToString(data));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function getCookie(req, name) {
  const header = req.headers.get("Cookie") || "";
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setSessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return `session=${encodeURIComponent(token)}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}