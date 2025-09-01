// src/services/api.ts
// Centralised fetch helpers with credentials included.

export type ApiResp<T = any> = T & { ok?: boolean; error?: string };

async function handle<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : (await res.text() as any);

  if (!res.ok) {
    const message =
      (isJson && typeof data === "object" && data && (data.error || (data as any).message)) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function apiGet<T = any>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    credentials: "include", // ensure cookies flow
  });
  return handle<T>(res);
}

export async function apiPost<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include", // ensure cookies flow
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}
