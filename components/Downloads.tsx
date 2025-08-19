
import React from 'react';

const DownloadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const Downloads: React.FC = () => {
  return (
    <section id="downloads" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Resources & Downloads</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            Download my CV and other relevant documents.
          </p>
        </div>
        <div className="max-w-2xl mx-auto bg-gray-50 p-8 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-lg text-gray-800 mb-4">Note for Site Owner:</h3>
            <p className="text-gray-600 mb-6">
                To make files downloadable, place them inside the `public/assets/` directory in your project folder. Then, update the `href` attribute in the links below to point to your files (e.g., `/assets/your-file-name.pdf`). The links below are placeholders.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <a 
                    href="/assets/Chris-Brighouse CV P.pdf" 
                    download 
                    className="w-full sm:w-auto flex items-center justify-center bg-brand-blue text-white font-semibold py-3 px-6 rounded-lg hover:bg-opacity-90 transition-all duration-300 shadow"
                >
                    <DownloadIcon />
                    Download CV (PDF)
                </a>
                <a 
                    href="/assets/Chris_Consulting_Services_SinglePage.pdf" 
                    download 
                    You said:
                    I need to make improvements to my Cloudflare worker Vite+React website, what is the best way to work with you on this?
                    ChatGPT said:
                    
                    Thought for 13s
                    Great—here’s the fastest, no-nonsense way we can work together on a Cloudflare Worker + Vite + React app.
                    
                    How to collaborate efficiently
                    Pick a working mode (any combo is fine)
                    
                    Repo review (best): Share a public GitHub URL. I’ll read the code and propose concrete PR-style changes (structure, config, perf, security).
                    
                    Targeted files: Paste the key files (below). I’ll annotate, refactor, and return diffs.
                    
                    Issue-driven: Describe a specific problem (error logs, steps to reproduce). I’ll pinpoint the fix and give patch snippets.
                    
                    Design-to-code: Tell me the feature; I’ll draft the components, routes, worker handlers, and infra changes.
                    
                    Send these artifacts first (copy/paste or repo link)
                    
                    package.json
                    
                    vite.config.ts
                    
                    wrangler.toml
                    
                    Worker entry (e.g. src/worker.ts or functions/[[path]].ts)
                    
                    React entry (index.html, src/main.tsx, router setup)
                    
                    Any server/SSR adapter you’re using (if applicable)
                    
                    Recent build/deploy output (wrangler build, wrangler deploy, or CI logs)
                    
                    Tell me your goals & constraints
                    
                    What “good” looks like (TTFB, Lighthouse score, cold-start limits, bundle size budget).
                    
                    CF bindings in play: KV / R2 / D1 / DOs / Queues / Turnstile.
                    
                    Hosting target: Workers, Pages Functions, or hybrid.
                    
                    Compatibility targets (browsers, edge regions, auth provider).
                    
                    We’ll iterate using a crisp loop
                    
                    I propose a change list with code patches.
                    
                    You apply/run wrangler dev, share console output or a preview URL.
                    
                    I adjust until green.
                    
                    High-impact areas I’ll focus on (out of the gate)
                    Build & routing
                    
                    Ensure static assets are fingerprinted and served via cacheTtl + Cache API.
                    
                    Verify vite.config.ts output split (vendor/code-splitting) and correct base.
                    
                    If you’re doing SSR: confirm streaming on Workers, avoid Node shims, and use isomorphic fetch only.
                    
                    Worker correctness & perf
                    
                    Eliminate Node APIs; prefer Web Streams, URLPattern, HTMLRewriter.
                    
                    Tighten wrangler.toml (bindings, durable object alarms, migrations).
                    
                    Add edge caching strategy (HTML vs. assets vs. API), ETag, and stale-while-revalidate where safe.
                    
                    Observability & DX
                    
                    Add minimal request logging, cf-ray correlation, and UnhandledRejection traps.
                    
                    Local dev via Miniflare (if you’re not already).
                    
                    Unit tests with Vitest; e2e with Playwright against wrangler dev.
                    
                    Security
                    
                    Secrets via Wrangler; no .env leaked into client.
                    
                    CSP headers, Turnstile (if forms), cookie flags if you use sessions/JWT.
                    
                    CI/CD
                    
                    GitHub Actions: cache pnpm/npm, wrangler deploy --env production, preview envs on PRs.
                    
                    If you want me to start right now
                    Share either:
                    
                    Your public repo URL, or
                    
                    Paste: package.json, vite.config.ts, wrangler.toml, and your worker entry file.
                    
                    From there I’ll do a quick audit and hand you a ranked fix list with exact patches.
                    
                    You said:
                    This is the github repository https://github.com/ChrisTheBruce/cb-site
                    ChatGPT said:
                    
                    Thought for 12s
                    I can’t open that repo—looks like it’s private or blocked from my side. No drama: either make it public/read-only or paste the key files and I’ll do a PR-style audit.
                    
                    In the meantime, here’s a tight, battle-tested baseline you can drop in (and what I’ll check first when you share code):
                    
                    What “good” looks like for Workers + Vite + React
                    Use the Cloudflare Vite plugin (run your worker in workerd during dev; avoids Node shims and config drift). 
                    Cloudflare Docs
                    
                    // vite.config.ts
                    import { defineConfig } from 'vite'
                    import react from '@vitejs/plugin-react'
                    import cloudflare from '@cloudflare/vite-plugin'
                    
                    export default defineConfig({
                      plugins: [
                        react(),
                        cloudflare({
                          // If you have a Worker backend, point to it here:
                          // entry: 'worker/index.ts',
                          // assets: { directory: 'dist' } // plugin handles asset routing
                        }),
                      ],
                      build: {
                        sourcemap: true,
                        cssCodeSplit: true,
                        chunkSizeWarningLimit: 600,
                        rollupOptions: {
                          output: {
                            manualChunks: {
                              react: ['react', 'react-dom'],
                            },
                          },
                        },
                      },
                    })
                    Wrangler config with SPA fallback and explicit exceptions for API routes.
                    
                    // wrangler.jsonc  (use this if you’re on the Vite plugin path)
                    {
                      "name": "cb-site",
                      "main": "worker/index.ts",
                      "assets": {
                        "not_found_handling": "single-page-application"
                      },
                      // Important: carve out API routes so SPA fallback doesn’t swallow them.
                      // If you hit routing conflicts for navigate requests to /api/*, move those
                      // to a separate Worker or disable SPA fallback and implement your own 200 fallback.
                      "routes": [
                        { "pattern": "yourdomain.com/api/*", "custom_domain": true }
                      ],
                      "compatibility_date": "2025-06-01"
                    }
                    Why: SPA fallback intercepts real browser navigations before the worker runs; that can break OAuth callbacks and direct API hits. If you have those flows, either (a) exclude /api/* from SPA fallback or (b) do a two-worker setup (one static/SPA, one API). 
                    GitHub
                    
                    Worker edge caching (fast TTFB, controlled HTML caching).
                    
                    // worker/index.ts
                    export default {
                      async fetch(request: Request, env: Env, ctx: ExecutionContext) {
                        const url = new URL(request.url)
                    
                        // Bypass SPA caching for API
                        if (url.pathname.startsWith('/api/')) {
                          return new Response(JSON.stringify({ ok: true }), {
                            headers: { 'content-type': 'application/json; charset=utf-8' },
                          })
                        }
                    
                        // Static assets: honor immutable caching
                        if (/\.(css|js|ico|png|jpg|svg|webp|woff2)$/.test(url.pathname)) {
                          const res = await env.ASSETS.fetch(request)
                          // If Vite hashed filenames, it’s safe to go long here:
                          const h = new Headers(res.headers)
                          h.set('cache-control', 'public, max-age=31536000, immutable')
                          return new Response(res.body, { status: res.status, headers: h })
                        }
                    
                        // HTML: cache short with SWR
                        const cache = caches.default
                        const cacheKey = new Request(url.toString(), request)
                        let res = await cache.match(cacheKey)
                        if (!res) {
                          res = await env.ASSETS.fetch(request)
                          const h = new Headers(res.headers)
                          h.set('cache-control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
                          // Minimal CSP (tighten as needed)
                          h.set(
                            'content-security-policy',
                            "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'"
                          )
                          res = new Response(res.body, { status: res.status, headers: h })
                          ctx.waitUntil(cache.put(cacheKey, res.clone()))
                        }
                        return res
                      },
                    } satisfies ExportedHandler
                    Pages vs Workers—pick one deliberately:
                    
                    Workers + Vite plugin when you want a proper backend/API and dev parity in workerd. 
                    Cloudflare Docs
                    
                    Pages (static) + optional Functions if it’s a pure SPA (build → upload dist/). If you go this route, deploy via Wrangler: wrangler pages deploy dist. 
                    vitejs
                    
                    GitHub Actions (cheap and fast)
                    
                    # .github/workflows/deploy.yml
                    name: Deploy
                    on:
                      push:
                        branches: [ main ]
                    jobs:
                      deploy:
                        runs-on: ubuntu-latest
                        permissions:
                          contents: read
                          id-token: write
                        steps:
                          - uses: actions/checkout@v4
                          - uses: actions/setup-node@v4
                            with: { node-version: '20' }
                          - run: corepack enable
                          - run: pnpm i --frozen-lockfile
                          - run: pnpm build
                          # Workers (with vite plugin)
                          - run: pnpm dlx wrangler deploy --env production --minify
                            env:
                              CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
                              CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
                          # Or Pages (static):
                          # - run: pnpm dlx wrangler pages deploy dist --project-name cb-site
                    DX & safety nets
                    
                    vitest + @cloudflare/vitest-pool-workers for route/unit tests in a Workers runtime.
                    
                    Basic request logging with cf-ray and timing.
                    
                    Keep secrets in Wrangler (never leak .env to client).
                    
                    Turn on source maps in prod and upload to your error tracker.
                    
                    How we proceed (fast path)
                    If you can, make the repo public (even temporarily).
                    
                    If not, paste these files and I’ll mark them up with diffs:
                    
                    package.json, vite.config.ts, wrangler.jsonc/wrangler.toml
                    
                    worker/index.ts (or your worker entry)
                    
                    index.html, src/main.tsx (or router entry)
                    
                    Any CI config
                    
                    I’ll then give you a ranked fix list (perf, routing, caching, security) with exact patches. If you already know your pain points (slow cold starts, broken deep links, OAuth callback issues, asset caching), say so and I’ll target those first.
                    
                    You said:
                    how do I make the repository public in github?
                    ChatGPT said:
                    Here’s the straight path to make your repo public:
                    
                    Go to your repo
                    Open github.com → log in → navigate to your repo (ChrisTheBruce/cb-site).
                    
                    Open Settings
                    At the top, click the ⚙️ Settings tab (on the repo, not your account).
                    
                    Scroll to "Danger Zone"
                    Scroll all the way down. You’ll see a red box called Danger Zone.
                    
                    Change visibility
                    
                    Find "Change repository visibility".
                    
                    Click Change visibility → choose Public.
                    
                    Confirm
                    
                    GitHub will warn you that the repo will be visible to anyone.
                    
                    Type your repo name (ChrisTheBruce/cb-site) to confirm.
                    
                    Click the confirmation button.
                    
                    ⚠️ Check before you flip the switch:
                    
                    Make sure no secrets (API tokens, Wrangler creds, env files) are committed. Search for .env, wrangler.toml with API keys, or anything sensitive.
                    
                    If you find any, remove them from history first (or use GitHub’s ).
                    
                    Do you want me to also walk you through how to scrub secrets from git history before you make it public, just in case anything sensitive is in there?
                    
                    You said:
                    I don't think there are any secrets in it, could you please check the github url now?
                    ChatGPT said:
                    Looks like I can’t open GitHub links directly from here (getting a 503 back from my browser service).
                    
                    But you can confirm whether it’s public yourself:
                    
                    Open an incognito/private browser window (not logged into GitHub).
                    
                    Paste your repo URL: https://github.com/ChrisTheBruce/cb-site.
                    
                    If you can see the code and readme there, then it’s public. If it asks you to log in or says “404,” it’s still private.
                    
                    👉 If it is public, the fastest way for me to help is if you copy-paste the key config files here (package.json, vite.config.ts, wrangler.toml/wrangler.jsonc, and your worker entry file). Then I can do a full audit and give you exact improvements.
                    
                    Do you want to paste those files here so I can start reviewing?
                    
                    You said:
                    yes it is public
                    ChatGPT said:
                    
                    Thought for 13s
                    Nice—congrats on making it public.
                    
                    Heads-up: my browsing tool is glitching on GitHub right now (I tried opening your repo and searching; both failed). I can’t fetch the files directly from the URL this minute.
                    
                    Two fast ways forward (your call):
                    
                    Paste the key files here (best for speed):
                    
                    package.json
                    
                    vite.config.*
                    
                    wrangler.toml or wrangler.jsonc
                    
                    Worker entry (e.g. src/worker.ts / functions/[[path]].ts)
                    
                    index.html, src/main.tsx (and router)
                    
                    Any CI (.github/workflows/*)
                    
                    If you use KV/R2/D1/DOs, include the binding bits
                    
                    If you prefer, paste the output of:
                    
                    tree -I node_modules
                    plus those config files. That gives me structure + code to audit.
                    
                    Either way, I’ll give you a PR-style review with concrete patches. In the meantime, here’s a quick improvement checklist I’ll run against your code the moment I see it:
                    
                    Vite config: proper code-splitting, hashed asset filenames, sourcemap: true, no Node polyfills.
                    
                    Worker: asset vs. HTML caching (immutable for hashed assets; SWR for HTML), SPA fallback that doesn’t eat /api/* or OAuth callbacks, CSP headers.
                    
                    Routing: 404/SPA deep-link handling verified locally via wrangler dev.
                    
                    Wrangler: clean compatibility_date, bindings declared (KV/R2/D1/Queues/DOs), no secrets in repo.
                    
                    DX: vitest + @cloudflare/vitest-pool-workers, minimal request logging with cf-ray, error boundary in React.
                    
                    CI: GitHub Actions with cached install, wrangler deploy or Pages deploy, preview env on PRs.
                    
                    Perf: Lighthouse budget, lazy routes/components, prefetch on hover, Link correctness.
                    
                    Drop the files and I’ll get you concrete diffs.
                    
                    You said:
                    I have uploaded the files.  there is no src folder, I'm using the root for this.  there is a wrangler.json file which I have uploaded, also index.ts rather than index.html
                    ChatGPT said:
                    
                    Thought for 34s
                    Got it. I pulled what you uploaded and here’s a no-fluff audit + exact patches to get your Worker + Vite + React deploy clean and fast.
                    
                    You’re currently set up to:
                    
                    build with Vite (vite.config.js) → output to dist
                    
                    serve dist via Workers assets binding (declared in wrangler.json)
                    
                    mount a React app from main.jsx
                    
                    But you don’t have an index.html. That means Vite’s default “HTML entry” build won’t work the way you expect. You’ve got two solid options; I’ll give you both, but I recommend Option A (manifest-driven SPA shell from the Worker).
                    
                    Option A — keep index.ts (Worker renders HTML) and let Vite build assets
                    1) Vite: turn on manifest + split vendor
                    Change vite.config.js (add manifest, sourcemaps, chunk split):
                    
                    - import { defineConfig } from 'vite'
                    - import react from '@vitejs/plugin-react'
                    + import { defineConfig } from 'vite'
                    + import react from '@vitejs/plugin-react'
                    
                     export default defineConfig({
                    -  plugins: [react()],
                    -  build: { outDir: "dist" }, // output goes to web/dist
                    -  base: "/"
                    +  plugins: [react()],
                    +  base: "/",
                    +  build: {
                    +    outDir: "dist",
                    +    sourcemap: true,
                    +    manifest: true,           // <-- critical: worker can resolve hashed filenames
                    +    cssCodeSplit: true,
                    +    rollupOptions: {
                    
                    className="w-full sm:w-auto flex items-center justify-center bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-600 transition-all duration-300 shadow"
                >
                    <DownloadIcon />
                    Services Overview (PDF)
                </a>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Downloads;
