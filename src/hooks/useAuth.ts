import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type User = {
  id: string;
  email: string;
  name?: string | null;
  [k: string]: unknown;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = async (signal?: AbortSignal) => {
    try {
      setError(null);
      // IMPORTANT: include credentials so cookies flow
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        headers: { "Accept": "application/json" },
        signal
      });
      if (!res.ok) {
        // not authenticated is fine; just null user
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data?.user ?? null);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError("Failed to load session");
      setUser(null);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      await fetchMe(ctrl.signal);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  const refresh = async () => {
    setLoading(true);
    await fetchMe();
    setLoading(false);
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } catch {
      // ignore
    } finally {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, loading, error, refresh, signOut }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
