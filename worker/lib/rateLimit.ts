export async function rateLimit(
  request: Request,
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: boolean; remaining: number; reset: number }> {
  const cache = caches.default;
  const now = Math.floor(Date.now() / 1000);
  const cacheKey = new Request(`https://ratelimit.local/${key}`);
  const hit = await cache.match(cacheKey);
  let count = 0;
  let windowStart = now;
  if (hit) {
    const data = await hit.json().catch(() => ({ count: 0, windowStart: now }));
    count = data.count || 0;
    windowStart = data.windowStart || now;
    if (now - windowStart >= windowSec) {
      count = 0;
      windowStart = now;
    }
  }
  count += 1;
  const reset = windowStart + windowSec;
  const ttl = Math.max(1, reset - now);
  await cache.put(
    cacheKey,
    new Response(JSON.stringify({ count, windowStart }), {
      headers: { "cache-control": `max-age=${ttl}` },
    })
  );
  return { ok: count <= limit, remaining: Math.max(0, limit - count), reset };
}
