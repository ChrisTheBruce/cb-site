// src/hooks/useAuth.ts
import { useEffect, useState, useCallback } from "react";

export type AuthUser = { name: string } | null;

type MeResponse =
  | { ok: true; user: { name: string } }
  | { ok: false };

async function fetchJSON(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const text = await res.text();
  try {
    // If empty body, return empty object
    return text ? JSON.parse(text) : {};
  } catch {
    return { _raw: text };
  }
}

// Try canonical first (/api/auth/me), then fall back to legacy (/api/me)
async function getMe(): Promise<MeResponse> {
  // canonical
  const r1 = await fetch("/api/auth/me", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (r1.ok) return (await r1.json()) as MeResponse;

  // If 401, we’re just unauthenticated; return { ok:false }
  if (r1.status === 401) return { ok: false };

  // Fallback for older routers still using /api/me
  const r2 = await fetch("/api/me", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (r2.ok) return (await r2.json()) as MeResponse;
  if (r2.status === 401) return { ok: false };

  // Unknown error → treat as unauthenticated but expose in console
  console.warn("Auth: /api/auth/me and /api/me both failed", r1.status, r2.status);
  return { ok: false };
}

// Try canonical logout first, then legacy
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

export function useAuth() {
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
      // Regardless of server response, clear client state
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Initial session check
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
