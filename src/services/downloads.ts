// src/services/downloads.ts
export async function postJson<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`POST ${url} failed: ${res.status} ${msg}`);
  }
  return res.json() as Promise<T>;
}

export async function clearDownloadEmail(): Promise<{ ok: boolean }> {
  // hits your Worker: POST /api/email/clear
  return postJson<{ ok: boolean }>('/api/email/clear');
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