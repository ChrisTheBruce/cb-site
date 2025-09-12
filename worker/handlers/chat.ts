// worker/handlers/chat.ts
// SSE chat proxy with MCP announce, diagnostics, and DBG logging.
// Supports OPENAI_API (your secret) or OPENAI_API_KEY (alt). Gateway via OPENAI_BASE_URL.

try { console.log("🐛 [chat] module loaded"); } catch {}

interface Env {
  OPENAI_API?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;   // e.g. https://gateway.ai.cloudflare.com/v1/.../cb-openai/
  OPENAI_BASE?: string;       // alt common name
  AI_GATEWAY_BASE?: string;   // Cloudflare AI Gateway as set in wrangler.jsonc
  AI_GATEWAY_URL?: string;    // alt name
  DEBUG_MODE?: string;        // "1","true","yes","on","debug" → enable
}

function isDebug(env: Env): boolean {
  const v = (env.DEBUG_MODE || "").toString().trim().toLowerCase();
  return ["1", "true", "yes", "on", "debug"].includes(v);
}
function DBG(env: Env, ...args: any[]) {
  if (!isDebug(env)) return;
  try { console.log("🐛 [chat]", ...args); } catch {}
}
function withTimeout(ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    try { ctrl.abort(`timeout:${ms}ms` as any); } catch {}
  }, ms);
  const cancel = () => { try { clearTimeout(timer); } catch {} };
  return { signal: ctrl.signal, cancel };
}


type Msg = { role: "system" | "user" | "assistant"; content: string };
type InboundBody = {
  messages: Msg[];
  model?: string;
  temperature?: number;
  mcp?: { name?: string; service?: string; [k: string]: unknown } | null;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TEMP = 0.5;

export default async function chat(req: Request, env: Env, ctx: any) {
  return handleChat(req, env, ctx);
}

/** Unified handler: GET → health/SSE self-test; POST → stream via OpenAI. */
export async function handleChat(req: Request, env: Env, _ctx: any) {
  const url = new URL(req.url);
  console.log("🐛 [chat] enter handleChat", req.method, url.pathname + url.search);

  try {
    if (req.method === "GET") {
      if (url.searchParams.get("ping")) {
        const payload = {
          ok: true,
          route: url.pathname,
          sse_test: `${url.pathname}?test=sse=1`,
          has_key: Boolean(getApiKey(env)),
          base_url_hint: getBaseUrl(env),
          debug: isDebug(env),
        };
        DBG(env, "ping", payload);
        return json(200, payload, req);
      }
      if (url.searchParams.get("test") === "sse") {
        DBG(env, "SSE self-test start");
        return sseTest();
      }
      return json(405, { ok: false, error: "Use POST for chat (or ?ping / ?test=sse)" }, req);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    if (req.method !== "POST") {
      return json(405, { ok: false, error: "Method Not Allowed" }, req);
    }

    // Parse request
    let body: InboundBody;
    try {
      body = (await req.json()) as InboundBody;
    } catch (e: any) {
      DBG(env, "Invalid JSON body", e?.message || String(e));
      return json(400, { ok: false, error: "Invalid JSON body" }, req);
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      DBG(env, "Missing 'messages' array");
      return json(400, { ok: false, error: "Missing 'messages' array" }, req);
    }

    const apiKey = getApiKey(env);
    if (!apiKey) {
      DBG(env, "OPENAI_API missing");
      return json(401, { ok: false, error: "OPENAI_API secret not configured" }, req);
    }

    const model = body.model || DEFAULT_MODEL;
    const temperature = typeof body.temperature === "number" ? body.temperature : DEFAULT_TEMP;
    const baseUrl = getBaseUrl(env);
    const upstreamUrl = `${baseUrl}/chat/completions`;

    // --- MCP: Geo lookup preflight -------------------------------------------------
    // Detect simple geo/location queries and enrich context with accurate coords
    let mcpServiceName: string | null = null;
    let mcpGeo: { lat: string; lon: string; name: string } | null = null;
    let enrichedMessages = body.messages;
    try {
      const lastUser = [...body.messages].reverse().find((m) => m?.role === "user")?.content || "";
      const q = extractGeoQuery(lastUser);
      if (q) {
        const geo = await geocode(q);
        if (geo) {
          mcpServiceName = "GeoLocator"; // only announce if we actually used it
          mcpGeo = geo;
          const sys = { role: "system" as const, content: `MCP GeoLocator result for "${q}": lat=${geo.lat}, lon=${geo.lon} (${geo.name}). Use these exact coordinates in your reply.` };
          enrichedMessages = [...body.messages, sys];
        }
      }
    } catch (e: any) {
      DBG(env, "geo mcp failed", e?.message || String(e));
    }


    // --- DEBUG: upstream target + self-recursion check ---
    const reqHost = new URL(req.url).host;
    const baseHost = (() => {
      try { return new URL(baseUrl).host; } catch { return "(bad baseUrl)"; }
    })();
    DBG(env, "chat: pre-fetch", { reqHost, baseHost, baseUrl, upstreamUrl });

    // OPTIONAL: log request headers you send upstream (helps spot loops)
    const loopMarker = crypto.randomUUID();
    DBG(env, "chat: add X-Loop-Trace", loopMarker);
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Loop-Trace": loopMarker,         // <-- harmless debug header
    };


    DBG(env, "Upstream config", { baseUrl, upstreamUrl, model, temperature, mcp: body?.mcp });
/* old
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, temperature, stream: true, messages: body.messages }),
    });
*/

    const connectTO = withTimeout(15000);
    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, temperature, stream: true, messages: enrichedMessages }),
        signal: connectTO.signal,
      });
    } catch (e: any) {
      DBG(env, "Upstream fetch error", e?.message || String(e));
      return json(502, { ok: false, error: `Upstream fetch failed: ${e?.message || String(e)}` }, req);
    } finally {
      connectTO.cancel();
    }

    DBG(env, "chat: post-fetch", {
      ok: upstream.ok,
      status: upstream.status,
      ctype: upstream.headers.get("content-type") || "",
      hasBody: Boolean(upstream.body)
    });


    if (!upstream.ok || !upstream.body) {
      const raw = (await safeText(upstream)).slice(0, 1000);
      const ctype = upstream.headers.get("content-type") || "";
      DBG(env, "Upstream error payload", raw?.slice(0, 400));
      let msg = raw;
      if (ctype.includes("application/json")) {
        try {
          const j = JSON.parse(raw);
          msg = j?.error?.message || j?.message || j?.error || JSON.stringify(j);
        } catch {}
      }
      return json(upstream.status || 502, { ok: false, error: msg }, req);
    }

    const encoder = new TextEncoder();
    const reader = upstream.body.getReader();

    DBG(env, "Begin streaming…");
    let bytes = 0, chunks = 0;

    const IDLE_MS = 20000;
    let idleTimer: number | ReturnType<typeof setTimeout> | null = null;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer as any);
      idleTimer = setTimeout(() => {
        try { reader.cancel("idle-timeout"); } catch {}
      }, IDLE_MS) as any;
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Emit MCP usage if provided by client or detected via geo enrichment
        let name: string | undefined;
        if (body?.mcp && (body.mcp.name || body.mcp.service)) {
          name = body.mcp.name || body.mcp.service as any;
        } else if (mcpServiceName) {
          name = mcpServiceName;
        }
        if (name) {
          DBG(env, "Emit MCP announce", name);
          controller.enqueue(encoder.encode(`event: mcp\ndata: ${JSON.stringify({ name })}\n\n`));
        }
        // Also embed a visible snippet as part of the assistant response so the coords are preserved in the transcript
        if (mcpGeo) {
          const snippet = `MCP coords: lat=${mcpGeo.lat}, lon=${mcpGeo.lon} (${mcpGeo.name})\n\n`;
          const deltaChunk = { choices: [{ index: 0, delta: { content: snippet } }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(deltaChunk)}\n\n`));
        }
        resetIdle();
      },
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            DBG(env, "Upstream finished", { chunks, bytes });
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
            return;
          }
          resetIdle();
          if (value && value.length) {
            bytes += value.length; chunks += 1;
            if (chunks === 1 || chunks % 20 === 0) DBG(env, "stream chunk", { chunks, bytes });
            controller.enqueue(value);
          }
        } catch (e: any) {
          const msg = e?.message || String(e);
          DBG(env, "Streaming error (pull)", msg);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },

      cancel(reason) {
        try { if (idleTimer) clearTimeout(idleTimer as any); } catch {}
        DBG(env, "Stream canceled", reason || "(no reason)");
        try { reader.cancel(reason || "client-canceled"); } catch {}
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders(req),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Robots-Tag": "noindex",
      },
    });

  } catch (e: any) {
    DBG(env, "Outer catch", e?.message || String(e));
    return json(500, { ok: false, error: `Internal error: ${e?.message || String(e)}` }, req);
  }
}

/** Back-compat explicit stream entry (works for both GET test and POST chat). */
export async function handleChatStream(req: Request, env: Env, ctx: any) {
  // Reuse the same logic; the route is just a different path.
  return handleChat(req, env, ctx);
}

// ---------------------------- helpers ----------------------------
function getApiKey(env: Env): string | null {
  return (
    env.OPENAI_API?.trim?.() ||
    env.OPENAI_API_KEY?.trim?.() ||
    null
  );
}
function getBaseUrl(env: Env): string {
  // Support multiple common env var names for the base
  let base = (
    (env as any)?.AI_GATEWAY_BASE?.toString?.().trim?.() ||
    env.OPENAI_BASE_URL?.toString?.().trim?.() ||
    (env as any)?.AI_GATEWAY_URL?.toString?.().trim?.() ||
    (env as any)?.OPENAI_BASE?.toString?.().trim?.() ||
    ""
  );

  if (base) {
    base = base.replace(/\/+$/, "");
    // Ensure gateway-style path includes /openai/v1 and avoid duplication if already present
    if (!/\/(openai)(\/|$)/.test(base)) base = `${base}/openai`;
    if (!/\/(v1)(\/|$)/.test(base)) base = `${base}/v1`;
    return base;
  }
  return "https://api.openai.com/v1";
}
function corsHeaders(req: Request, allowCredentials = false): Record<string, string> {
  const origin = req.headers.get("Origin") || "*";
  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };
  if (allowCredentials) h["Access-Control-Allow-Credentials"] = "true";
  return h;
}
function json(status: number, obj: unknown, req: Request): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(req) },
  });
}
async function safeText(r: Response): Promise<string> { try { return await r.text(); } catch { return ""; } }
function sseTest(): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(`event: mcp\ndata: {"name":"TestService"}\n\n`));
      controller.enqueue(enc.encode(`data: This is a test SSE stream.\n\n`));
      controller.enqueue(enc.encode(`data: It proves routing & streaming work.\n\n`));
      controller.enqueue(enc.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Robots-Tag": "noindex",
    },
  });
}

// ---------------------------- MCP helpers ----------------------------
function extractGeoQuery(text: string): string | null {
  const t = (text || "").trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  // Basic patterns: "coordinates of X", "location of X", "where is X", "coords for X"
  const m1 = lower.match(/(?:coordinates|coords)\s+(?:of|for)\s+(.+)/);
  const m2 = lower.match(/location\s+(?:of|for)\s+(.+)/);
  const m3 = lower.match(/where\s+is\s+(.+)/);
  // New patterns: "lat/long X", "lat long X", "lat-long X", allow optional "of|for"
  const m4 = lower.match(/lat(?:itude)?[\s\-\/]+(?:lon|long|longitude)\s+(?:of|for)?\s+(.+)/);
  const m5 = lower.match(/(?:lon|long|longitude)[\s\-\/]+lat(?:itude)?\s+(?:of|for)?\s+(.+)/);
  const m = m1 || m2 || m3 || m4 || m5;
  if (!m) return null;
  const q = m[1].trim();
  // Strip trailing punctuation
  return q.replace(/[?.!]+$/, "").slice(0, 120);
}

async function geocode(q: string): Promise<{ lat: string; lon: string; name: string } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "1");
    const r = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        // Add a UA as recommended by Nominatim usage policy
        "User-Agent": "cb-site/1.0 (chrisbrighouse.com)"
      },
      // timeout to avoid hangs
      signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(5000) : undefined,
    });
    if (!r.ok) return null;
    const arr = await r.json().catch(() => [] as any[]);
    if (!Array.isArray(arr) || !arr.length) return null;
    const first = arr[0];
    const lat = String(first?.lat ?? "");
    const lon = String(first?.lon ?? "");
    if (!lat || !lon) return null;
    const name = String(first?.display_name || q);
    return { lat, lon, name };
  } catch {
    return null;
  }
}
