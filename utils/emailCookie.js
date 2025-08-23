const COOKIE_NAME = 'cb_email'; // ← if you currently use a different name, change this to match.

export function getEmailCookie() {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export function setEmailCookie(email) {
  const expires = new Date();
  expires.setDate(expires.getDate() + 180); // ~6 months
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(email)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  window.dispatchEvent(new Event('cb-email-changed'));
}

export function clearEmailCookie() {
  // expire immediately
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  window.dispatchEvent(new Event('cb-email-changed'));
}
