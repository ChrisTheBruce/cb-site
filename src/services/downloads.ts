// src/services/downloads.ts

const NOTIFY_ENDPOINT =
  (import.meta as any)?.env?.VITE_DOWNLOAD_NOTIFY_ENDPOINT || "/api/download-notify";
const EMAIL_SET_ENDPOINT =
  (import.meta as any)?.env?.VITE_DOWNLOAD_EMAIL_SET_ENDPOINT || "/api/email/set";
const EMAIL_CLEAR_ENDPOINT =
  (import.meta as any)?.env?.VITE_DOWNLOAD_EMAIL_CLEAR_ENDPOINT || "/api/email/clear";

export async function postJson<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`POST ${url} failed: ${res.status} ${msg}`);
  }
  return res.json() as Promise<T>;
}

export function readEmailCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)download_email=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookieClient(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires}; SameSite=Lax`;
}

function clearCookieClient(name: string) {
  if (typeof document === "undefined") return;
  // host-only clear
  document.cookie = `${name}=; Path=/; Expires=${new Date(0).toUTCString()}; SameSite=Lax`;
}

/** Server-preferred: set the email cookie (falls back to client if server route missing). */
export async function setEmail(email: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(EMAIL_SET_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    if (res.ok) return (await res.json()) as { ok: boolean };
    setCookieClient("download_email", email);
    return { ok: true };
  } catch {
    setCookieClient("download_email", email);
    return { ok: true };
  }
}

/** Clear server cookie(s) and ALWAYS clear the client copy too. */
export async function clearEmail(): Promise<{ ok: boolean }> {
  try {
    await fetch(EMAIL_CLEAR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
  } catch {
    // ignore network errors - we still clear locally below
  }
  clearCookieClient("download_email");
  return { ok: true };
}

export async function notifyDownload(payload: Record<string, unknown>): Promise<boolean> {
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon(
        NOTIFY_ENDPOINT,
        new Blob([body], { type: "application/json" })
      );
      if (ok) return true;
    }
  } catch {}

  try {
    await fetch(NOTIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "include",
    });
    return true;
  } catch {
    return false;
  }
}


/*

// src/services/downloads.ts
import { apiPost } from "./api";
import type { ApiResp } from "@/types";

// *** Tell the worker which email to associate with the current session.
 
export async function setEmail(email: string): Promise<ApiResp<{ email: string }>> {
  return apiPost("/api/email", { email });
}

// ** * Clear the stored email for this session.

export async function clearEmail(): Promise<ApiResp> {
  return apiPost("/api/email/clear");
}

// * Notify the worker that a file has been downloaded.
 
export async function notifyDownload(pathOrUrl: string, title?: string): Promise<ApiResp<{ warn?: string }>> {
  return apiPost("/api/notify_download", { path: pathOrUrl, title });
}

// * Read the email cookie set by the worker.

export function readEmailCookie(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)dl_email=([^;]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}
*/