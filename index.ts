// index.ts

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