// Blocks direct access to /downloads/* when the cb_email cookie is missing.
export async function onRequest(context) {
  const { request } = context;
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/downloads/")) {
    const cookie = request.headers.get("Cookie") || "";
    if (!/(^|;\s*)cb_email=/.test(cookie)) {
      const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Download requires email</title></head>
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px;">
    <h1 style="margin:0 0 8px;">Email required</h1>
    <p>Go back to the downloads page and click the link again; you'll be prompted for your email.</p>
    <p><a href="/" style="color:#1f6feb;text-decoration:none;">Return to site</a></p>
  </body>
</html>`;
      return new Response(html, { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
    }
  }
  return context.next();
}
