// /src/bootClearEmail.ts
(() => {
  try {
    if (typeof window === 'undefined') return;
    // Clear server cookie
    fetch('/api/email/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
    }).catch(() => {});
    // Also clear host-only cookie immediately for UI logic
    document.cookie = `download_email=; Path=/; Expires=${new Date(0).toUTCString()}; SameSite=Lax`;
    // optional client-side debug
    (window as any).__DEBUG__ && console.debug('[boot] cleared download_email at startup');
  } catch {}
})();
