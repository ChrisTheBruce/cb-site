import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, loading } = useAuth();

  const [username, setUsername] = useState("chris");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("next") || "/Chat";
  }, [location.search]);

  useEffect(() => {
    if (isAuthenticated) navigate(nextPath, { replace: true });
  }, [isAuthenticated, nextPath, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (!username.trim() || !password.trim()) throw new Error("Please enter username and password.");
      const ok = await login(username.trim(), password);
      if (!ok) throw new Error("Invalid username or password.");
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err?.message || "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "start center", minHeight: "60vh", padding: "2rem 1rem" }}>
      {/* Scoped reset container to avoid global CSS bleeding in */}
      <div
        className="cb-login"
        style={{
          all: "initial",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          color: "#111",
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          padding: "20px",
        }}
      >
        <h1 style={{ all: "revert", margin: 0, marginBottom: 12, fontSize: 24, fontWeight: 600 }}>Sign in</h1>

        {error ? (
          <div
            role="alert"
            style={{
              all: "revert",
              margin: "0 0 12px",
              padding: "10px 12px",
              border: "1px solid #e00",
              borderRadius: 8,
              background: "#ffecec",
              fontSize: 14,
              lineHeight: 1.3,
            }}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} noValidate style={{ display: "grid", gap: 12 }}>
          <label style={{ all: "revert" }}>
            <div style={{ marginBottom: 6, fontSize: 14 }}>Username</div>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                all: "revert",
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                outline: "none",
              }}
            />
          </label>

          <label style={{ all: "revert" }}>
            <div style={{ marginBottom: 6, fontSize: 14 }}>Password</div>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                all: "revert",
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={busy || loading}
            style={{
              all: "revert",
              marginTop: 4,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #222",
              background: busy || loading ? "#efefef" : "#fff",
              cursor: busy || loading ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div style={{ all: "revert", marginTop: 6, fontSize: 12, color: "#666" }}>
            Hint: <code>chris / badcommand</code>
          </div>
        </form>
      </div>
    </div>
  );
}
