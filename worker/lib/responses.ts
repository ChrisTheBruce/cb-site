export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
}

export function bad(status: number, message: string, rid: string, details?: any) {
  return json({ ok: false, error: message, rid, details }, { status });
}
