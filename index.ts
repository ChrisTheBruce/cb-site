// index.ts — API, auth, downloads, notifications for chris.brighouse.com
// This replaces the existing Worker entrypoint. It keeps login/auth as-is,
// and extends functionality to support downloads with email cookie + notify.

interface Env {
  ASSETS: Fetcher;
  SUPPORT_TO_EMAIL: string;
  SENDER_EMAIL: string;
  SENDER_NAME: string;
  RESEND_API_KEY: string;
  CORS_ORIGIN?: string;
}

const DOWNLOAD_EMAIL_COOKIE = "cb_email";
const AUTH_COOKIE_NAMES = ["cb_auth", "session", "auth", "auth_token"] as const;
const PRIMARY_AUTH_COOKIE = "cb_auth";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);
      const origin = url.origin;
      const pathname = url.pathname;

      // --- CORS preflight ---
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors(env, origin) });
      }

      // -------- API --------
      if (pathname.startsWith("/api/")) {
        try {
          // ---- LOGIN ----
          if (pathname === "/api/login" && req.method === "POST") {
            const body = await readBody(req);
            const username = (body.username || body.email || "").toString().trim();
            const password = (body.password || "").toString();

            if (username !== "chris" || password !== "badcommand") {
              return json({ ok: false, error: "Invalid username or password." }, 401, env, origin);
            }

            const token = crypto.randomUUID();
            return json(
              { ok: true },
              200,
              env,
              origin,
              [`${PRIMARY_AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`]
            );
          }

          // ---- LOGOUT ----
          if (pathname === "/api/logout") {
            return json(
              { ok: true },
              200,
              env,
              origin,
              [`${PRIMARY_AUTH_COOKIE}=; Path=/; Max-Age=0`]
            );
          }

          // ---- AUTH CHECK ----
          if (pathname === "/api/me") {
            const cookies = parseCookies(req.headers.get("Cookie") || "");
            if (cookies[PRIMARY_AUTH_COOKIE]) {
              return json({ ok: true, user: "chris" }, 200, env, origin);
            }
            return json({ ok: false }, 401, env, origin);
          }

          // ---- SET DOWNLOAD EMAIL ----
          if (pathname === "/api/set-email" && req.method === "POST") {
            const body = await readBody(req);
            const email = (body.email || "").toString().trim();

            if (!validateEmail(email)) {
              return json({ ok: false, error: "Invalid email format" }, 400, env, origin);
            }

            return json(
              { ok: true, email },
              200,
              env,
              origin,
              [`${DOWNLOAD_EMAIL_COOKIE}=${email}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`]
            );
          }

          // ---- DOWNLOAD ----
          if (pathname.startsWith("/api/download/") && req.method === "GET") {
            const cookies = parseCookies(req.headers.get("Cookie") || "");
            const email = cookies[DOWNLOAD_EMAIL_COOKIE];

            if (!email) {
              return json({ ok: false, error: "No email cookie set" }, 403, env, origin);
            }

            const filename = pathname.replace("/api/download/", "");
            const fileUrl = `${url.origin}/assets/${filename}`;

            ctx.waitUntil(sendDownloadEmail(env, email, filename));

            return Response.redirect(fileUrl, 302);
          }

          // ---- UNKNOWN API ----
          return json({ ok: false, error: "Not found" }, 404, env, origin);
        } catch (err) {
          return json({ ok: false, error: (err as Error).message }, 500, env, origin);
        }
      }

      // -------- STATIC --------
      return env.ASSETS.fetch(req);
    } catch (err) {
      return new Response("Internal Error", { status: 500 });
    }
  },
};

// ---------- Helpers ----------

function parseCookies(header: string): Record<string, string> {
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, v] = c.trim().split("=");
      return [k, v];
    })
  );
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function cors(env: Env, origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

function json(data: any, status: number, env: Env, origin: string, setCookies?: string[]): Response {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...cors(env, origin),
  };
  if (setCookies) headers["Set-Cookie"] = setCookies.join(", ");
  return new Response(JSON.stringify(data), { status, headers });
}

// ---- Send notification email ----
async function sendDownloadEmail(env: Env, email: string, filename: string) {
  const body = {
    from: `${env.SENDER_NAME} <${env.SENDER_EMAIL}>`,
    to: [env.SUPPORT_TO_EMAIL],
    subject: `Download: ${filename}`,
    text: `User ${email} downloaded ${filename}.`,
  };

  await fetch("https://api.resend.com/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
