// /worker/do/DownloadLog.ts
import { DurableObject } from "cloudflare:workers";

type Env = {
  EXPORT_USER?: string;
  EXPORT_PASS?: string;
};

type Row = {
  id: string;
  ts: number;
  email: string;
  path: string;
  title?: string | null;
  ua?: string | null;
  ip?: string | null;
  referer?: string | null;
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "https://chrisbrighouse.com",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true"
  } as const;
}

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  Object.entries(cors()).forEach(([k, v]) => headers.set(k, v));
  return new Response(JSON.stringify(body), { ...init, headers });
}

function csvEscape(s: any): string {
  if (s === null || s === undefined) return "";
  const str = String(s);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function shorten(s: string, n = 180) {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

export class DownloadLog extends DurableObject {
  private sql: SqlStorage;
  private env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.env = env;

    // Idempotent schema
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id      TEXT PRIMARY KEY,
        ts      INTEGER NOT NULL,
        email   TEXT NOT NULL,
        path    TEXT NOT NULL,
        title   TEXT,
        ua      TEXT,
        ip      TEXT,
        referer TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_downloads_ts    ON downloads (ts);
      CREATE INDEX IF NOT EXISTS idx_downloads_email ON downloads (email);
      CREATE INDEX IF NOT EXISTS idx_downloads_path  ON downloads (path);
    `);
  }

  private requireBasicAuth(req: Request): Response | null {
    const user = this.env.EXPORT_USER;
    const pass = this.env.EXPORT_PASS;
    if (!user || !pass) return null; // exports open if creds not set

    const hdr = req.headers.get("authorization") || "";
    if (!hdr.startsWith("Basic ")) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { ...cors(), "WWW-Authenticate": 'Basic realm="exports"' } as any
      });
    }
    try {
      const [u, p] = atob(hdr.slice(6)).split(":");
      if (u === user && p === pass) return null;
    } catch {}
    return new Response("Unauthorized", {
      status: 401,
      headers: { ...cors(), "WWW-Authenticate": 'Basic realm="exports"' } as any
    });
  }

  private parseRange(url: URL) {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(100000, Math.max(1, Number(url.searchParams.get("limit") || 5000) | 0));
    const where: string[] = [];
    const args: any[] = [];

    if (from) {
      const t = Date.parse(from);
      if (!Number.isNaN(t)) { where.push("ts >= ?"); args.push(t); }
    }
    if (to) {
      const t = Date.parse(to);
      if (!Number.isNaN(t)) { where.push("ts <= ?"); args.push(t); }
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    return { whereSql, args, limit };
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    // Append a log row
    if (req.method === "POST" && pathname === "/append") {
      let payload: any = null;
      try { payload = await req.json(); } catch { return json({ ok: false, error: "invalid json" }, { status: 400 }); }

      const { path, title, email, ts, ua, ip, referer } = payload || {};
      if (!path || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        return json({ ok: false, error: "missing/invalid path or email" }, { status: 400 });
      }

      const when = Number.isFinite(ts) ? Number(ts) : Date.now();
      const id = (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${when}-${Math.random().toString(36).slice(2)}`;

      try {
        this.sql.exec(
          `INSERT INTO downloads (id, ts, email, path, title, ua, ip, referer)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          id, when, String(email), String(path),
          title ? String(title) : null,
          ua ? String(ua) : null,
          ip || null,
          referer || null
        );

        // Add debug header the Worker can print
        return json({ ok: true, id }, { headers: { "X-DO-Log": `append ok id=${id}` } });
      } catch (err: any) {
        return json({ ok: false, error: "db insert failed" }, {
          status: 500,
          headers: { "X-DO-Log": `append error ${String(err?.message || err)}` }
        });
      }
    }

    // JSON export
    if (req.method === "GET" && pathname === "/export.json") {
      const unauthorized = this.requireBasicAuth(req);
      if (unauthorized) return unauthorized;

      const { whereSql, args, limit } = this.parseRange(url);
      const sql = `SELECT id, ts, email, path, title, ua, ip, referer
                   FROM downloads ${whereSql}
                   ORDER BY ts DESC
                   LIMIT ${limit}`;

      try {
        const cursor = this.sql.exec(sql, ...args);
        const rows = cursor.toArray() as Row[];
        return json(
          { ok: true, count: rows.length, rows },
          { headers: { "X-DO-Count": String(rows.length), "X-DO-Sql": shorten(sql) } }
        );
      } catch (err: any) {
        return json(
          { ok: false, error: "export failed" },
          { status: 500, headers: { "X-DO-Log": `export.json error ${String(err?.message || err)}`, "X-DO-Sql": shorten(sql) } }
        );
      }
    }

    // CSV export
    if (req.method === "GET" && pathname === "/export.csv") {
      const unauthorized = this.requireBasicAuth(req);
      if (unauthorized) return unauthorized;

      const { whereSql, args, limit } = this.parseRange(url);
      const sql = `SELECT id, ts, email, path, title, ua, ip, referer
                   FROM downloads ${whereSql}
                   ORDER BY ts DESC
                   LIMIT ${limit}`;

      try {
        const cursor = this.sql.exec(sql, ...args);
        const rows = cursor.toArray() as Row[];

        const header = ["id","ts","iso","email","path","title","ua","ip","referer"];
        const lines: string[] = [header.join(",")];

        for (const r of rows) {
          const iso = new Date(Number(r.ts || 0)).toISOString();
          lines.push([
            csvEscape(r.id),
            csvEscape(r.ts),
            csvEscape(iso),
            csvEscape(r.email),
            csvEscape(r.path),
            csvEscape(r.title ?? ""),
            csvEscape(r.ua ?? ""),
            csvEscape(r.ip ?? ""),
            csvEscape(r.referer ?? "")
          ].join(","));
        }

        const headers = new Headers({
          ...cors(),
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="downloads_${new Date().toISOString().slice(0,10)}.csv"`
        } as any);
        headers.set("X-DO-Count", String(rows.length));
        headers.set("X-DO-Sql", shorten(sql));

        return new Response(lines.join("\n"), { status: 200, headers });
      } catch (err: any) {
        return json(
          { ok: false, error: "export failed" },
          { status: 500, headers: { "X-DO-Log": `export.csv error ${String(err?.message || err)}`, "X-DO-Sql": shorten(sql) } }
        );
      }
    }

    return json({ ok: false, error: `No route for ${pathname}` }, { status: 404 });
  }
}
