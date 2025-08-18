// index.ts
/* export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env?.ASSETS?.fetch) {
      return new Response("ASSETS binding missing", { status: 500 });
    }

    const url = new URL(request.url);
    let res = await env.ASSETS.fetch(request);

    // If root or any HTML route 404s, serve /index.html (fixes “can’t be found” at /)
    const wantsHtml = (request.headers.get("Accept") || "").includes("text/html");
    if ((url.pathname === "/" || wantsHtml) && res.status === 404) {
      const indexReq = new Request(new URL("/index.html", url), request);
      res = await env.ASSETS.fetch(indexReq);
    }
    return res;
  }
} */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1) Try to serve a static file from /dist
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;

    // 2) If not an asset path, serve index.html for SPA routes
    const isAsset = url.pathname.startsWith('/assets/')
      || /\.(css|js|map|png|jpg|jpeg|gif|svg|ico|txt|webp|woff2?|ttf|eot)$/i.test(url.pathname);

    if (!isAsset) {
      const indexUrl = new URL('/index.html', url.origin);
      return env.ASSETS.fetch(new Request(indexUrl, request));
    }

    // 3) Real asset but missing -> return original 404
    return assetResponse;
  }
};