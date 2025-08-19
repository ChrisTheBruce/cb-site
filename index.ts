// index.ts (Worker entry)
interface Env {
  ASSETS: Fetcher; // provided by "assets.directory": "dist"
}

type ManifestEntry = {
  file: string;
  css?: string[];
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Serve actual static assets from /dist with long cache
    if (/\.(css|js|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot|txt|map)$/i.test(url.pathname)) {
      const res = await env.ASSETS.fetch(request);
      if (res.ok) {
        const h = new Headers(res.headers);
        h.set('cache-control', 'public, max-age=31536000, immutable');
        return new Response(res.body, { status: res.status, headers: h });
      }
      return res;
    }

    // Build the HTML shell by reading the Vite manifest
    const manifestRes = await env.ASSETS.fetch(new Request(new URL('/manifest.json', url.origin)));
    if (!manifestRes.ok) {
      // If manifest missing, let Assets try (useful during early setup)
      return env.ASSETS.fetch(request);
    }

    const manifest = (await manifestRes.json()) as Record<string, ManifestEntry>;
    // Adjust key if your entry is named differently
    const entry =
      manifest['main.jsx'] ||
      manifest['src/main.jsx'] ||
      Object.values(manifest)[0];

    if (!entry?.file) {
      return new Response('Build manifest missing entry.', { status: 500 });
    }

    const scriptPath = `/${entry.file}`;
    const cssTags = (entry.css || []).map(c => `<link rel="stylesheet" href="/${c}">`).join('');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chris Brighouse — Products for Engineering Projects & Operations</title>
  <meta name="description" content="Azure-native applications with AI features for engineering operations.">
  <link rel="canonical" href="https://chrisbrighouse.com/" />
  <meta property="og:title" content="Chris Brighouse — Product & Platform" />
  <meta property="og:description" content="Building fast, maintainable apps for engineering operations." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://chrisbrighouse.com/" />
  <meta name="theme-color" content="#ffffff">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
</head>
  <body>
    <div id="root"></div>
    <script type="module" src="${scriptPath}"></script>
  </body>
</html>`;

    const headers = new Headers({
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      'content-security-policy': "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'"
    });

    return new Response(html, { status: 200, headers });
  }
} satisfies ExportedHandler<Env>;
