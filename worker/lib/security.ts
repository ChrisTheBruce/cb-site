export function isAllowedMethod(request: Request, methods: string[]) {
  return methods.includes(request.method.toUpperCase());
}

export function requireOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!origin && !referer) return true; // non-browser clients
  try {
    const r = new URL((origin || referer)!);
    const u = new URL(request.url);
    return r.host === u.host && r.protocol === u.protocol;
  } catch {
    return false;
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
export const normEmail = (e: string) => e.trim().toLowerCase();
