import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

async function fetchSession(signal?: AbortSignal): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.user as User) ?? null;
  } catch (e: any) {
    if (e?.name === "AbortError") return null;
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Start signed-out with no initial fetch so the UI always shows "Sign in" on first load
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const u = await fetchSession();
      setUser(u);
    } catch {
      setError("Failed to refresh session");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network errors on logout
    } finally {
      setUser(null);
    }
  };

  const value: AuthContextValue = useMemo(
    () => ({ user, loading, error, refresh, signOut }),
    [user, loading, error]
  );

  // No JSX in a .ts file:
  return React.createElement(AuthContext.Provider, { value }, children as any);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
