// functions/[[path]].ts
// Cloudflare Pages Functions – catch-all for /api/*

type Env = Record<string, unknown>;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://chrisbrighouse.com",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true",
};

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
  return new Response(JSON.stringify(body), { ...init, headers });
}

function normaliseApiPath(url: URL) {
  // remove leading /api and trailing slashes
  const sub = url.pathname.replace(/^\/api(\/|$)/, "/").replace(/\/+$/, "") || "/";
  return sub;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const subPath = normaliseApiPath(url);

  console.log("[🐛 DBG] api:incoming", { method, path: url.pathname, subPath });

  // --- CORS preflight ---
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Health check ---
  if (method === "GET" && subPath === "/__whoami") {
    return json({ ok: true, path: url.pathname, subPath, ts: Date.now() });
  }

  // --- Clear download email cookie ---
  if (method === "POST" && subPath === "/email/clear") {
    const expires = new Date(0).toUTCString();
    const setCookie = [
      "download_email=",
      "Path=/",
      `Expires=${expires}`,
      "Max-Age=0",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Domain=chrisbrighouse.com", // remove if you only need apex
    ].join("; ");

    console.log("[🐛 DBG] matched /api/email/clear → clearing cookie");

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "application/json");
    headers.append("Set-Cookie", setCookie);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  // --- Other API routes go here ---
  // (If you have additional logic, add more conditions above)

  // --- Fallback 404 ---
  console.log("[🐛 DBG] api:noRoute", { method, subPath });
  return json({ ok: false, error: `No route for ${url.pathname}` }, { status: 404 });
};
