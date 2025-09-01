// Centralised JSON fetch with credentials + basic error handling
export async function apiGet<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET", credentials: "include" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractErr(data, res.status));
  return data as T;
}

export async function apiPost<T = any>(url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(extractErr(data, res.status));
  return data as T;
}

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: text || res.statusText }; }
}

function extractErr(data: any, status: number) {
  if (data && typeof data === "object" && "error" in data) return `${status} ${data.error}`;
  return `${status} ${typeof data === "string" ? data : "Request failed"}`;
}
