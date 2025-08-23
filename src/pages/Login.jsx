import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);

    if (!username || !password) {
      setErr("Enter both username and password.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include", // allows cookie to be set
      });

      if (res.ok) {
        // success: HttpOnly cookie set by server
        nav("/chat"); // change this if your chat route is named differently
      } else if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        setErr(data && data.error ? data.error : "Invalid credentials.");
      } else {
        setErr("Login failed (" + res.status + ").");
      }
    } catch (err) {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>Login</h1>
      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        {err && (
          <div role="alert" style={{ color: "crimson", marginBottom: 12 }}>
            {err}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{ padding: "8px 14px", cursor: "pointer" }}
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
