import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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

// Helper: try primary URL, fall back to alternate if 404/405
async function fetchWithFallback(primary: RequestInfo, init: RequestInit, fallback: RequestInfo) {
  const res = await fetch(primary, init);
  if (res.status === 404 || res.status === 405) return fetch(fallback, init);
  return res;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const bootstrappedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchWithFallback("/api/me", { credentials: "include" }, "/api/auth/me");
      if (res.status === 401) { setUser(null); return; }
      if (!res.ok) { console.warn("Auth refresh failed:", res.status); setUser(null); return; }
      const data = await res.json().catch(() => null);
      setUser(data && typeof data === "object" ? data : null);
    } catch (e) {
      console.warn("Auth refresh error:", e);
      setUser(null);
    }
  }, []);

  // Run once (even under StrictMode)
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    // Try a few common shapes so we match whatever your Worker expects
    const attempts: Array<{ pathA: string; pathB: string; init: RequestInit }> = [
      // JSON, { username, password }
      {
        pathA: "/api/login",
        pathB: "/api/auth/login",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password }),
        },
      },
      // JSON, { user, pass }
      {
        pathA: "/api/login",
        pathB: "/api/auth/login",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user: username, pass: password }),
        },
      },
      // form-urlencoded
      {
        pathA: "/api/login",
        pathB: "/api/auth/login",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          credentials: "include",
          body: new URLSearchParams({ username, password }).toString(),
        },
      },
    ];

    for (const t of attempts) {
      try {
        const res = await fetchWithFallback(t.pathA, t.init, t.pathB);
        if (res.ok) {
          await refresh();
          return true;
        }
        // If 400/401, try next shape; if 404/405, fallback already handled
      } catch (e) {
        // try next attempt
      }
    }
    return false;
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetchWithFallback("/api/logout", { method: "POST", credentials: "include" }, "/api/auth/logout");
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

export function useAuth(): AuthContextShape {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
