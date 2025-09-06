// src/hooks/useAuth.ts
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AuthUser = { name: string } | null;

type MeResponse =
  | { ok: true; user: { name: string } }
  | { ok: false };

type AuthContextShape = {
  user: AuthUser;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextShape | null>(null);

// ---------- utilities ----------
async function fetchJSON(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { _raw: text };
  }
}

async function getMe(): Promise<MeResponse> {
  // canonical
  const r1 = await fetch("/api/auth/me", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (r1.ok) return (await r1.json()) as MeResponse;
  if (r1.status === 401) return { ok: false };

  // legacy fallback
  const r2 = await fetch("/api/me", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (r2.ok) return (await r2.json()) as MeResponse;
  if (r2.status === 401) return { ok: false };

  console.warn("Auth: /api/auth/me and /api/me both failed", r1.status, r2.status);
  return { ok: false };
}

async function postLogout(): Promise<boolean> {
  const r1 = await fetch("/api/auth/logout", {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (r1.ok) return true;

  const r2 = await fetch("/api/logout", {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  return r2.ok;
}

// ---------- Provider (restores the named export expected by main.jsx) ----------
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await getMe();
      if (me && (me as any).ok && (me as any).user) {
        setUser((me as any).user);
      } else {
        setUser(null);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to check session");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await postLogout();
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Initial session check
    refresh();
  }, [refresh]);

  const value = useMemo<AuthContextShape>(() => ({
    user,
    isAuthenticated: !!user,
    loading,
    error,
    refresh,
    logout,
  }), [user, loading, error, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------- Hook (default export) ----------
function useAuth(): AuthContextShape {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;

  // Fallback: work even if no <AuthProvider> is mounted (defensive)
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await getMe();
      if (me && (me as any).ok && (me as any).user) {
        setUser((me as any).user);
      } else {
        setUser(null);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to check session");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await postLogout();
    } finally {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    refresh,
    logout,
  };
}

export default useAuth;
