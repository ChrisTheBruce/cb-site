import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();

  // If already logged in, go straight to /chat
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (!cancelled && res.ok) nav("/chat", { replace: true });
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, [nav]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error("bad creds");
      nav("/chat", { replace: true });
    } catch {
      setErr("Invalid username or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          className="border rounded p-2"
          placeholder="Username"
          value={username}
          onChange={(e)=>setU(e.target.value)}
          autoComplete="username"
        />
        <input
          className="border rounded p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e)=>setP(e.target.value)}
          autoComplete="current-password"
        />
        {err && <div className="text-red-600">{err}</div>}
        <button
          className="border rounded p-2 disabled:opacity-60"
          type="submit"
          disabled={submitting || !username || !password}
        >
          {submitting ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
