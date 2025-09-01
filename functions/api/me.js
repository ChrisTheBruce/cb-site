// me.js (React page)
// Shows the current logged-in user and a Logout button.
// Fetches /api/me and /api/logout on the same origin.

import React, { useEffect, useState } from "react";

export default function Me() {
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function loadMe() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data?.user ?? null);
      } else if (res.status === 401) {
        setUser(null);
      } else {
        setError(`Failed to fetch profile (${res.status})`);
      }
    } catch (e) {
      setError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setUser(null);
        // (optional) notify others (e.g., Navbar) that auth changed
        window.dispatchEvent(new Event("auth:changed"));
      } else {
        setError(`Logout failed (${res.status})`);
      }
    } catch (e) {
      setError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: 24 }}>
      <h1 style={{ margin: 0, marginBottom: 12, fontSize: 24 }}>Me</h1>

      {busy && <p style={{ opacity: 0.75 }}>Loading…</p>}

      {!busy && user && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            background: "#fafafa",
          }}
        >
          <p style={{ margin: 0 }}>
            Signed in as <strong>{user.username}</strong>
          </p>
          <button
            onClick={logout}
            disabled={busy}
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ef4444",
              background: "#ef4444",
              color: "#fff",
              cursor: busy ? "default" : "pointer",
            }}
          >
            Logout
          </button>
        </div>
      )}

      {!busy && !user && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <p style={{ margin: 0 }}>
            You are <strong>not</strong> signed in.
          </p>
          <p style={{ marginTop: 8 }}>
            Go to the <a href="/login">login</a> page to sign in.
          </p>
        </div>
      )}

      {error && (
        <p style={{ color: "#b00020", marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
