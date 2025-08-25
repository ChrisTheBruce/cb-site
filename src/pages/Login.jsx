// Login.jsx — swap in completely
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // If already logged in, bounce to chat
    (async () => {
      try {
        const r = await fetch("/api/me", { credentials: "include" });
        if (r.ok) nav("/chat");
      } catch {}
    })();
  }, [nav]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data?.error || `Login failed (${r.status})`);
      } else {
        nav("/chat");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  // Simple inline styles to guarantee visibility regardless of global CSS
  const inputStyle = {
    display: "block",
    width: "100%",
    padding: "10px 12px",
    marginTop: 6,
    marginBottom: 14,
    border: "1px solid #c7c7c7",
    borderRadius: 6,
    fontSize: 16,
    color: "#111",
    background: "#fff",
    outline: "none",
  };

  const labelStyle = { fontSize: 14, color: "#333" };

  return (
    <div style={{ maxWidth: 360, margin: "60px auto", padding: 24, border: "1px solid #eee", borderRadius: 12 }}>
      <h1 style={{ margin: 0, marginBottom: 16, fontSize: 20 }}>Login</h1>

      <form onSubmit={onSubmit} noValidate>
        <label style={labelStyle} htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          style={inputStyle}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
        />

        <label style={labelStyle} htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          style={inputStyle}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
        />

        {error && <div style={{ color: "#b00020", marginBottom: 8 }}>{error}</div>}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            borderRadius: 6,
            border: "1px solid #1b6",
            background: busy ? "#9ee" : "#0cc",
            color: "#033",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
