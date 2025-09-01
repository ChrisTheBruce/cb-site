// Login.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [alreadyAuthed, setAlreadyAuthed] = useState(false);

  // If already authenticated, redirect (to /chat by default)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (!cancelled && res.ok) {
          setAlreadyAuthed(true);
          const to = new URLSearchParams(loc.search).get("to") || "/chat";
          nav(to, { replace: true });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [nav, loc.search]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        // (optional) notify others (e.g., Navbar) that auth changed
        window.dispatchEvent(new Event("auth:changed"));
        const to = new URLSearchParams(loc.search).get("to") || "/chat";
        nav(to, { replace: true });
      } else {
        setError(data?.error || `Sign in failed (${res.status})`);
      }
    } catch (err) {
      setError(err?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

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
      <h1 style={{ margin: 0, marginBottom: 16, fontSize: 20 }}>Sign in</h1>

      {alreadyAuthed && (
        <div style={{ marginBottom: 12, color: "#065f46" }}>
          You’re already signed in — redirecting…
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <label style={labelStyle} htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          style={inputStyle}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username (hint: chris)"
        />

        <label style={labelStyle} htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          style={inputStyle}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password (hint: badcommand)"
        />

        {error && (
          <div style={{ color: "#b00020", marginBottom: 8 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            borderRadius: 6,
            border: "1px solid #0cc",
            background: busy ? "#9ee" : "#0cc",
            color: "#fff",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
