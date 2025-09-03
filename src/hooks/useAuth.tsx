import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Me = { username: string } | null;

type AuthContextShape = {
  isAuthenticated: boolean;
  user: Me;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

/**
 * Provider that:
 * - On mount, calls /api/me.
 * - Treats 401 as "not signed in" (no throw).
 * - Exposes login/logout helpers that hit your Worker handlers.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) {
        // soft-fail; don’t crash the app
        console.warn("Failed to fetch /api/me:", res.status);
        setUser(null);
        return;
      }
      const data = await res.json().catch(() => null);
      setUser(data && typeof data === "object" ? data : null);
    } catch (e) {
      console.warn("Error calling /api/me", e);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) return false;
      await refresh();
      return true;
    } catch (e) {
      console.warn("login error:", e);
      return false;
    }
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextShape>(() => ({
    isAuthenticated: !!user,
    user,
    loading,
    login,
    logout,
    refresh,
  }), [user, loading, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook used by pages/components. Throws if you forgot to wrap in <AuthProvider>.
 */
export function useAuth(): AuthContextShape {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
