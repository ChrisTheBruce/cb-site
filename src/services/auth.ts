// src/services/auth.ts
export type User = { username: string };

async function parseJSON(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export async function login(username: string, password: string): Promise<User> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",         // include cookies
    cache: "no-store",
    body: JSON.stringify({ username, password }),
  });

  const data = await parseJSON(res);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "Login failed");
  }
  return data.user as User;
}

export async function me(): Promise<User | null> {
  const res = await fetch("/api/me", {
    method: "GET",
    credentials: "same-origin",         // include cookies
    cache: "no-store",
  });

  if (res.status === 401) return null;
  const data = await parseJSON(res);
  if (!res.ok || !data?.ok) return null;
  return data.user as User;
}

export async function logout(): Promise<void> {
  const res = await fetch("/api/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await parseJSON(res);
    throw new Error(data?.error || "Logout failed");
  }
}
