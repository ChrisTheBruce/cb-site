import { createContext, useContext, useEffect, useState } from "react";
import { me, login as apiLogin, logout as apiLogout } from "./auth";

const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  useEffect(() => { me().then(setUser).catch(() => setUser(null)); }, []);
  const login = async (u, p) => { const r = await apiLogin(u, p); setUser({ username: r.username }); };
  const logout = async () => { await apiLogout(); setUser(null); };
  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
