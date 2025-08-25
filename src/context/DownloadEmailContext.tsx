import React, { createContext, useContext, useEffect, useState } from "react";

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

export const DownloadEmailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [email, setEmailState] = useState<string | null>(null);

  useEffect(() => {
    // Try to load email from cookie (server sets cb_email)
    const match = document.cookie.match(/cb_email=([^;]+)/);
    if (match) {
      setEmailState(decodeURIComponent(match[1]));
    }
  }, []);

  const setEmail = async (email: string): Promise<boolean> => {
    const res = await fetch("/api/set-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setEmailState(email);
      return true;
    }
    return false;
  };

  const clearEmail = () => {
    document.cookie = "cb_email=; path=/; max-age=0";
    setEmailState(null);
  };

  return (
    <DownloadEmailContext.Provider value={{ email, setEmail, clearEmail }}>
      {children}
    </DownloadEmailContext.Provider>
  );
};

export const useDownloadEmail = () => useContext(DownloadEmailContext);
