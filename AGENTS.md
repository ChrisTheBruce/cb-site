Project Overview (cb-site)

This repo powers chrisbrighouse.com. It consists of a React single‑page app (built by Vite) and a Cloudflare Worker that serves API routes, static assets, and gated downloads.

Key Technologies
- Frontend: React + Vite (assets built to dist/)
- Worker runtime: Cloudflare Workers (TypeScript)
- Deployment: wrangler (Production environment), assets bound as ASSETS

How It’s Wired Now
- No itty-router. All API routing is explicit in worker/index.ts inside fetch(). This avoided prior hangs and simplifies reasoning/debugging.
- Worker routes (Cloudflare Dashboard → Worker → Triggers):
  - chrisbrighouse.com/api/*
  - www.chrisbrighouse.com/api/*
- Optionally, a broader site route may also exist for everything else; the API routes above must exist to guarantee API requests reach the Worker.

Worker Entry (worker/index.ts)
- Primary responsibilities:
  - Handle /api/* with explicit if/else routing
  - CORS preflight for API (OPTIONS)
  - Static asset serving via env.ASSETS (Vite output)
  - Gate /downloads/* when no email cookie is present

API Endpoints (explicit routing)
- Auth, 
  - POST /api/auth/login → worker/handlers/auth.login
  - GET  /api/auth/me → worker/handlers/auth.me
  - POST /api/auth/logout → worker/handlers/auth.logout
  - Aliases: POST /api/login, GET /api/me (returns { authenticated, user? }), POST /api/logout
  - Diagnostics: POST /api/auth/ping returns { ok, ts }
  - Diagnostics: POST /api/auth/login with header x-diag-skip-auth: 1 returns { ok, diag }
- Chat
  - GET/POST /api/chat/stream → worker/handlers/chat.handleChat
  - POST /ai/chat/stream → alias → chat.handleChat
  - POST /api/chat/echo-stream → simple SSE echo for plumbing tests
- Notify (download event logging via Durable Object)
  - POST /api/notify/download → worker/handlers/notify.handleDownloadNotify (stores event in DO)
  - POST /api/download-notify → alias
  - GET  /api/admin/downloads → returns normalized JSON array of recent events (auth required)
- Email (downloads cookie)
  - POST /api/email/set → worker/handlers/email.setDownloadEmailCookie
  - POST /api/email/clear → worker/handlers/email.clearDownloadEmailCookie

Session & Cookies
- Auth cookie name: cb_session
- Production cookie domain: .chrisbrighouse.com
- HttpOnly, Path=/, Max‑Age=7d; SameSite=None + Secure on HTTPS
- GET /api/auth/me expects cb_session; returns { ok: true, user } on success
- Legacy GET /api/me returns { authenticated, user? }

Chat Upstream (OpenAI or AI Gateway)
- worker/handlers/chat.ts reads base from one of:
  - AI_GATEWAY_BASE, OPENAI_BASE_URL, AI_GATEWAY_URL, OPENAI_BASE
  - Ensures gateway paths include /openai/v1 when needed
- API key from OPENAI_API or OPENAI_API_KEY
- Supports GET diagnostics: ?ping and ?test=sse
- Streams SSE chunks to the client

CORS
- API preflight (OPTIONS) returns:
  - Access-Control-Allow-Methods: GET, POST, OPTIONS
  - Access-Control-Allow-Headers: content-type, authorization, accept, x-diag-skip-auth
  - Access-Control-Max-Age: 600
  - If Origin is allowed (https://www.chrisbrighouse.com or https://chrisbrighouse.com):
    - Access-Control-Allow-Origin: <origin>
    - Access-Control-Allow-Credentials: true
    - Vary: Origin
- Chat handler also sets streaming-appropriate headers.

Downloads Gate
- Any GET to /downloads/* requires one of these cookies:
  - download_email, cb_dl_email, or DL_EMAIL
- If missing, responds with a 403 HTML explaining how to proceed.
- On app startup, the client clears any existing download_email cookie so the user is prompted the next time they initiate a download; after entering email once per session, subsequent downloads proceed without prompting until cleared from the badge.

Environment & Config
- wrangler.jsonc (Production environment):
  - main: worker/index.ts
  - assets: { directory: dist, binding: ASSETS }
  - durable_objects: { bindings: [{ name: DOWNLOAD_LOG, class_name: DownloadLog }] }
  - migrations: includes DownloadLog
  - routes: set in Dashboard (ensure /api/* attached to Production)
  - vars of note: AI_GATEWAY_BASE, DEBUG_MODE
- worker/env.ts defines helper DBG(), isDebug(), and the Env type used across handlers.

Local Scripts
- npm run dev → Vite dev server for the frontend
- npm run build → builds the frontend to dist/

Deploy
- Explicitly deploy to Production to avoid env mismatch warnings:
  - wrangler deploy --env=production
  - Verify in Dashboard → Worker → Environment: Production → Deployments
  - Ensure Triggers → Routes include the two /api/* routes in Production

Sanity Tests (curl)
- Ping: curl -i -X POST https://www.chrisbrighouse.com/api/auth/ping
- Login: curl -i -X POST https://www.chrisbrighouse.com/api/auth/login -H "Content-Type: application/json" --data '{"username":"chris","password":"badcommand"}'
- Auth me: curl -i https://www.chrisbrighouse.com/api/auth/me -H "Cookie: cb_session=<paste>"
- Legacy me: curl -i https://www.chrisbrighouse.com/api/me -H "Cookie: cb_session=<paste>"
- Chat SSE test: curl -i -X GET 'https://www.chrisbrighouse.com/api/chat/stream?test=sse'
- Chat POST: curl -i -X POST https://www.chrisbrighouse.com/api/chat/stream -H "Content-Type: application/json" --data '{"messages":[{"role":"user","content":"Hello"}]}'

- Notify (store in DO): curl -i -X POST https://www.chrisbrighouse.com/api/notify/download -H "Content-Type: application/json" --data '{"path":"/assets/Chris-Brighouse-CV.pdf","title":"CV","email":"test@example.com","ts":1690000000000,"ua":"curl"}'
- Admin DO export (must be signed in): curl -i https://www.chrisbrighouse.com/api/admin/downloads

Troubleshooting Tips
- If /api/* returns 500 with “Worker hung”, ensure you deployed to the same environment that owns the routes (Production) and that /api/* routes exist there.
- Use wrangler tail --env=production to capture the exact error line for failing endpoints.
- Keep diagnostics (ping and x-diag-skip-auth) enabled for quick wiring checks.
- If admin downloads shows HTML instead of JSON, verify the Worker route is taking effect and you are authenticated; the endpoint returns JSON { items: [...] }.
