// src/hooks/useAuth.ts
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Auth from "../services/auth";

type AuthCtx = {
  user: Auth.User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signIn: (u: string, p: string) => Promise<Auth.User>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const u = await Auth.me();
      setUser(u);
    } catch (e: any) {
      setError(String(e?.message || e));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // On first mount, check session. Don't redirect here—just set state.
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (username: string, password: string) => {
    setError(null);
    const u = await Auth.login(username, password);
    // Ensure cookie is committed server-side, then confirm with /api/me
    await refresh();
    return u;
  }, [refresh]);

  const signOut = useCallback(async () => {
    setError(null);
    await Auth.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user, loading, error, refresh, signIn, signOut
  }), [user, loading, error, refresh, signIn, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
