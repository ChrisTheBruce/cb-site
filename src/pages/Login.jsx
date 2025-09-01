// Login.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
// Adjust this path if your file is in a different folder:
// e.g. "./hooks/useAuth" or "../../hooks/useAuth"
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const nav = useNavigate();
  const { user, loading, error: authErr, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // If already authenticated, go straight to chat (matches your current behaviour)
  useEffect(() => {
    if (!loading && user) {
      nav("/chat");
    }
  }, [loading, user, nav]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const resp = await login(username, password);
      if (!(resp && resp.ok)) {
        setError((resp && resp.error) || "Sign in failed");
      } else {
        // notify anything listening (e.g. Navbar) that auth state changed
        window.dispatchEvent(new Event("auth:changed"));
        nav("/chat");
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

        {(error || authErr) && (
          <div style={{ color: "#b00020", marginBottom: 8 }}>
            {error || authErr}
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
