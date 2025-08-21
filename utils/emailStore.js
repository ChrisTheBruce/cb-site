// Simple, dependency-free email persistence + events.
const KEY = "cb_email";
const EVENT = "cb-email-change";

function readEmailFromCookie() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)cb_email=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function getEmail() {
  try {
    return localStorage.getItem(KEY) || readEmailFromCookie();
  } catch {
    return readEmailFromCookie();
  }
}

export function requireValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email || "").trim());
}

export function setEmail(email) {
  if (!email) return;
  try { localStorage.setItem(KEY, email); } catch {}
  document.cookie = `cb_email=${encodeURIComponent(email)}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: email }));
}

export function onEmailChange(handler) {
  const f = (e) => handler(e.detail ?? getEmail());
  const s = (e) => { if (e.key === KEY) handler(e.newValue); };
  window.addEventListener(EVENT, f);
  window.addEventListener("storage", s);
  return () => {
    window.removeEventListener(EVENT, f);
    window.removeEventListener("storage", s);
  };
}
