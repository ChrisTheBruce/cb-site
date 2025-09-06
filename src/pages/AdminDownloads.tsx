import React, { useEffect, useState } from "react";

type DownloadRow = {
  ts: string;         // ISO string
  email: string;
  file: string;       // filename (or path — we’ll just show the filename)
};

type ApiResponse = {
  items: DownloadRow[];
  cursor?: string | null;
  hasMore?: boolean;
};

function formatLocal(dt: string) {
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleString();
  } catch {
    return dt;
  }
}

export default function AdminDownloads() {
  const [rows, setRows] = useState<DownloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/downloads?limit=100", {
          method: "GET",
          headers: {
            "Accept": "application/json"
          },
          credentials: "include"
        });

        if (res.status === 401) {
          setError("Please sign in to view download logs.");
          setRows([]);
          return;
        }
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `HTTP ${res.status}`);
        }
        const data: ApiResponse = await res.json();
        if (!cancelled) {
          // Defensive map (only keep the three columns we care about)
          const clean = (data.items || []).map((r) => ({
            ts: r.ts,
            email: r.email,
            file: r.file?.split("/").pop() || r.file || ""
          }));
          setRows(clean);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load logs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: "1.25rem", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.75rem" }}>Download Logs</h1>
      <p style={{ color: "#666", marginBottom: "1rem" }}>
        Showing latest records first. Columns: Date/Time (local), Email, Filename.
      </p>

      {loading && <div>Loading…</div>}
      {error && (
        <div style={{
          padding: "0.75rem 1rem",
          background: "#fff3cd",
          border: "1px solid #ffeeba",
          borderRadius: 8,
          color: "#856404",
          marginBottom: "1rem"
        }}>
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div>No downloads found.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e5e5" }}>
                <th style={{ padding: "0.5rem" }}>Date / Time</th>
                <th style={{ padding: "0.5rem" }}>Email</th>
                <th style={{ padding: "0.5rem" }}>Filename</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.ts}-${idx}`} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{formatLocal(r.ts)}</td>
                  <td style={{ padding: "0.5rem" }}>{r.email}</td>
                  <td style={{ padding: "0.5rem" }}>{r.file}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
