// src/auth/ProtectedRoute.jsx
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('loading');
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (cancelled) return;

        if (res.status === 200) {
          const me = await res.json();
          if ('authenticated' in me && me.authenticated) setState('authed');
          else setState('anon');
        } else if (res.status === 401) {
          setState('anon');
        } else {
          setState('anon'); // treat other errors as anon; optional: show error UI
        }
      } catch {
        setState('anon');
      }
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  if (state === 'loading') return null; // or a spinner
  if (state === 'authed') return <>{children}</>;
  return <Navigate to="/login" replace state={{ from: location }} />;
}
