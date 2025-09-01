import * as React from "react";
import {
  setEmail as apiSetEmail,
  clearEmail as apiClearEmail,
  readEmailCookie,
  notifyDownload,
} from "@/services/downloads"; // <-- points to services, not components

export function useDlEmail() {
  const [email, setEmailState] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // hydrate from cookie on mount
  React.useEffect(() => {
    setEmailState(readEmailCookie());
  }, []);

  const submitEmail = React.useCallback(async (value: string) => {
    setBusy(true);
    setError(null);
    const resp = await apiSetEmail(value);
    if ((resp as any).ok) {
      setEmailState((resp as any).email || value);
    } else {
      setError((resp as any).error || "Email not accepted");
    }
    setBusy(false);
    return resp;
  }, []);

  const clear = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    const resp = await apiClearEmail();
    if ((resp as any).ok) {
      setEmailState(null);
    } else {
      setError((resp as any).error || "Could not clear");
    }
    setBusy(false);
    return resp;
  }, []);

  const notify = React.useCallback(async (filePathOrUrl: string, title?: string) => {
    return notifyDownload(filePathOrUrl, title);
  }, []);

  return { email, busy, error, submitEmail, clear, notify };
}
