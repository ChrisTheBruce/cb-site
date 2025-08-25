// src/context/DownloadEmailContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type DownloadEmailContextType = {
  email: string | null;
  setEmail: (email: string) => Promise<boolean>;
  clearEmail: () => void;
};

const DownloadEmailContext = createContext<DownloadEmailContextType>({
  email: null,
  setEmail: async () => false,
  clearEmail: () => {},
});

const EMAIL_COOKIE = "cb_dl_email";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "Secure; " : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; ${secure}SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export const DownloadEmailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [email, setEmailState] = useState<string | null>(null);

  // Load from cookie on mount
  useEffect(() => {
    setEmailState(readCookie(EMAIL_COOKIE));
  }, []);

  const api = useMemo<DownloadEmailContextType>(() => ({
    email,
    // Immediately persist to cookie + state; no server call needed
    setEmail: async (e: string) => {
      writeCookie(EMAIL_COOKIE, e, ONE_YEAR);
      setEmailState(e);
      return true;
    },
    clearEmail: () => {
      clearCookie(EMAIL_COOKIE);
      setEmailState(null);
    },
  }), [email]);

  return (
    <DownloadEmailContext.Provider value={api}>
      {children}
    </DownloadEmailContext.Provider>
  );
};

export const useDownloadEmail = () => useContext(DownloadEmailContext);
