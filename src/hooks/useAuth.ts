import * as React from "react";
import { login as apiLogin, logout as apiLogout, me } from "@/services/auth";
import type { User } from "@/types";

type State = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

export function useAuth() {
  const [state, set] = React.useState<State>({ user: null, loading: true, error: null });

  const refresh = React.useCallback(async () => {
    set(s => ({ ...s, loading: true, error: null }));
    try {
      const resp = await me();
      if ((resp as any).ok) set({ user: (resp as any).user, loading: false, error: null });
      else set({ user: null, loading: false, error: (resp as any).error || "Not authenticated" });
    } catch (e: any) {
      set({ user: null, loading: false, error: e.message || "Not authenticated" });
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const login = React.useCallback(async (username: string, password: string) => {
    set(s => ({ ...s, loading: true, error: null }));
    const resp = await apiLogin(username, password);
    if ((resp as any).ok) set({ user: (resp as any).user, loading: false, error: null });
    else set({ user: null, loading: false, error: (resp as any).error || "Login failed" });
    return resp;
  }, []);

  const logout = React.useCallback(async () => {
    set(s => ({ ...s, loading: true, error: null }));
    const resp = await apiLogout();
    set({ user: null, loading: false, error: (resp as any).ok ? null : (resp as any).error || null });
    return resp;
  }, []);

  return { ...state, login, logout, refresh };
}
