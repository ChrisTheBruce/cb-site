/* old
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
*/

//new
// index.ts (Worker entry)
interface Env {
  ASSETS: Fetcher; // auto-provided for assets.directory
}

type ManifestEntry = {
  file: string;
  css?: string[];
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // 1) Asset requests – let the Assets binding serve them.
    if (/\.(css|js|ico|png|jpg|jpeg|svg|webp|woff2|txt|map)$/.test(url.pathname)) {
      const res = await env.ASSETS.fetch(request);
      if (res.ok) {
        const h = new Headers(res.headers);
        // Hashed assets are safe to cache long and immutable.
        h.set('cache-control', 'public, max-age=31536000, immutable');
        return new Response(res.body, { status: res.status, headers: h });
      }
      return res;
    }

    // 2) SPA navigations – return HTML shell pointing to hashed bundle.
    // Read manifest produced by Vite (dist/manifest.json).
    const manifestRes = await env.ASSETS.fetch(new Request(new URL('/manifest.json', url.origin)));
    if (!manifestRes.ok) {
      // Fallback to asset handler (lets Wrangler's SPA fallback kick in too)
      return env.ASSETS.fetch(request);
    }
    const manifest = (await manifestRes.json()) as Record<string, ManifestEntry>;

    // Your JS entry is main.jsx (based on your upload). Adjust if different.
    const entry = manifest['main.jsx'] || manifest['src/main.jsx'] || Object.values(manifest)[0];
    if (!entry?.file) {
      return new Response('Build manifest missing entry.', { status: 500 });
    }

    const scriptPath = `/${entry.file}`;
    const cssTags =
      (entry.css || [])
        .map((c) => `<link rel="stylesheet" href="/${c}">`)
        .join('');

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>cb-site</title>
    ${cssTags}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${scriptPath}"></script>
  </body>
</html>`;

    // Cache HTML briefly with SWR
    const h = new Headers({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      // Tighten CSP later if you add external resources
      'content-security-policy':
        "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
    });

    return new Response(html, { status: 200, headers: h });
  },
} satisfies ExportedHandler<Env>;
