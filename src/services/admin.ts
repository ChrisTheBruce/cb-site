export type DownloadRow = { ts: string; email: string; file: string };
export type DownloadsResult = { items: DownloadRow[]; cursor?: string | null; hasMore?: boolean };

export async function getAdminDownloads(opts?: { cursor?: string; limit?: number }): Promise<DownloadsResult> {
  const params = new URLSearchParams();
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.limit)  params.set("limit", String(opts.limit));

  const res = await fetch(`/api/admin/downloads${params.size ? `?${params}` : ""}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
    credentials: "include"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}
