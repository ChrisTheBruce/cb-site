// src/hooks/useDlEmail.ts
import { useCallback, useMemo, useState } from "react";
import {
  readEmailCookie,
  setEmail as apiSetEmail,
  clearEmail as apiClearEmail,
  notifyDownload,
} from "@/services/downloads";

/**
 * Simple hook to manage the downloads-email lifecycle:
 * - reads cookie on mount
 * - exposes ensureEmail() to prompt user if missing
 * - exposes setEmail/clearEmail wrappers
 */
export function useDlEmail() {
  const [email, setEmailState] = useState<string | null>(() => readEmailCookie());

  const setEmail = useCallback(
    async (value: string) => {
      await apiSetEmail(value);
      setEmailState(value);
      return { ok: true } as const;
    },
    [setEmailState]
  );

  const clearEmail = useCallback(async () => {
    await apiClearEmail();
    setEmailState(null);
    return { ok: true } as const;
  }, [setEmailState]);

  const ensureEmail = useCallback(async (): Promise<string | false> => {
    let current = readEmailCookie();
    if (current) {
      setEmailState(current);
      return current;
    }
    // Minimal in-browser prompt. Replace with your modal if you have one.
    const entered = typeof window !== "undefined" ? window.prompt("Please enter your email to continue:") : null;
    if (!entered) return false;

    const trimmed = entered.trim();
    // Very light validation
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!valid) {
      alert("That doesn't look like a valid email address.");
      return false;
    }
    await setEmail(trimmed);
    return trimmed;
  }, [setEmail]);

  return useMemo(
    () => ({
      email,
      setEmail,
      clearEmail,
      ensureEmail,
      notifyDownload, // re-exported for convenience if needed
    }),
    [email, setEmail, clearEmail, ensureEmail]
  );
}

export type UseDlEmail = ReturnType<typeof useDlEmail>;
