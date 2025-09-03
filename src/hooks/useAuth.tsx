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

// Helper: try a primary URL, fall back to an alternate if 404/405
async function fetchWithFallback(
  primary: RequestInfo,
  init: RequestInit,
  fallback: RequestInfo
): Promise<Response> {
  const res = await fetch(primary, init);
  if (res.status === 404 || res.status === 405) {
    // endpoint shape mismatch — try the alternate path
    return fetch(fallback, init);
  }
  return res;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      // Try /api/me first, then /api/auth/me
      const res = await fetchWithFallback(
        "/api/me",
        { credentials: "include" },
        "/api/auth/me"
      );

      if (res.status === 401) {
        // Not signed in — normal pre-login state
        setUser(null);
        return;
      }
      if (!res.ok) {
        console.warn("Auth refresh failed:", res.status);
        setUser(null);
        return;
      }
      const data = await res.json().catch(() => null);
      setUser(data && typeof data === "object" ? data : null);
    } catch (e) {
      console.warn("Auth refresh error:", e);
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
      const body = JSON.stringify({ username, password });
      const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body,
      };

      // Try /api/login first, then /api/auth/login
      const res = await fetchWithFallback("/api/login", init, "/api/auth/login");
      if (!res.ok) {
        // Best-effort read of server message
        let msg = "";
        try { msg = await res.text(); } catch {}
        console.warn("Login failed:", res.status, msg);
        return false;
      }
      await refresh();
      return true;
    } catch (e) {
      console.warn("Login error:", e);
      return false;
    }
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      const init: RequestInit = { method: "POST", credentials: "include" };
      await fetchWithFallback("/api/logout", init, "/api/auth/logout");
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
