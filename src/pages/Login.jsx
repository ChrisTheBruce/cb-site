// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const t = await res.text();
        try {
          const j = JSON.parse(t);
          setError(j?.error || "Login failed.");
        } catch {
          setError("Login failed.");
        }
        return;
      }
      // Success -> go to Chat
      navigate("/chat", { replace: true });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto", padding: "1.5rem", border: "1px solid #eee", borderRadius: 12 }}>
      <h1 style={{ marginBottom: "1rem" }}>Sign In</h1>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Username</label>
          <input
            type="text"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: 8 }}
            required
          />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: 8 }}
            required
          />
        </div>

        {error && (
          <div style={{
            marginBottom: "0.75rem",
            padding: "0.5rem 0.75rem",
            background: "#fdecea",
            border: "1px solid #f5c2c0",
            borderRadius: 8,
            color: "#842029"
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #0d6efd",
            background: submitting ? "#8ab6ff" : "#0d6efd",
            color: "#fff",
            cursor: submitting ? "default" : "pointer"
          }}
        >
          {submitting ? "Signing In…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
