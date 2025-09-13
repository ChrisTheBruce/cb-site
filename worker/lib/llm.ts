// Minimal chat completion helper using the same env vars as chat.ts

type Env = {
  OPENAI_API?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_BASE?: string;
  AI_GATEWAY_BASE?: string;
  AI_GATEWAY_URL?: string;
};

export function getApiKey(env: Env): string | null {
  return env.OPENAI_API || env.OPENAI_API_KEY || null;
}

export function getBaseUrl(env: Env): string {
  const base = env.AI_GATEWAY_BASE || env.OPENAI_BASE_URL || env.AI_GATEWAY_URL || env.OPENAI_BASE || "https://api.openai.com/v1";
  // Ensure a single /openai/v1 if gateway base lacks it
  try {
    const u = new URL(base);
    const p = u.pathname.replace(/\/+$/, "");
    if (!/\/v\d+$/.test(p)) {
      // append /openai/v1 (Cloudflare AI Gateway convention)
      u.pathname = (p + "/openai/v1").replace(/\/+/, "/");
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return base.replace(/\/$/, "");
  }
}

export async function chatOnce(env: Env, messages: { role: "system"|"user"|"assistant"; content: string }[], opts?: { model?: string; temperature?: number }): Promise<string> {
  const apiKey = getApiKey(env);
  if (!apiKey) throw new Error("OPENAI_API not configured");
  const base = getBaseUrl(env);
  const url = `${base}/chat/completions`;
  const model = opts?.model || "gpt-4o-mini";
  const temperature = typeof opts?.temperature === 'number' ? opts!.temperature : 0.2;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature, stream: false, messages })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0,200)}`);
  }
  const j = await res.json().catch(() => ({} as any));
  const content = j?.choices?.[0]?.message?.content ?? "";
  return String(content || "");
}

