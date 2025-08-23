// src/auth/ProtectedRoute.tsx
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

type MeOk = { authenticated: true; username: string };
type MeNo = { authenticated: false };

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading'|'authed'|'anon'>('loading');
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        if (cancelled) return;

        if (res.status === 200) {
          const me = (await res.json()) as MeOk | MeNo;
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
