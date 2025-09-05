// /src/bootClearEmail.ts
(() => {
  try {
    const FLAG = 'dl_cleared_once';
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem(FLAG)) return;

    sessionStorage.setItem(FLAG, '1');
    fetch('/api/email/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
    }).catch(() => {});
    // Also nuke any host-only cookie immediately for UI logic
    document.cookie = `download_email=; Path=/; Expires=${new Date(0).toUTCString()}; SameSite=Lax`;
    // optional client-side debug
    (window as any).__DEBUG__ && console.debug('[boot] cleared download_email at startup');
  } catch {}
})();
