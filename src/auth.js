export async function login(username, password) {
  const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password })});
  if (!res.ok) throw new Error("Invalid credentials");
  return res.json();
}
export async function me() {
  const res = await fetch("/api/me");
  if (!res.ok) return null;
  return res.json();
}
export async function logout() {
  await fetch("/api/logout", { method: "POST" });
}
