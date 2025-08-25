// Navbar.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

export default function Navbar() {
  const nav = useNavigate();
  const location = useLocation();
  const [signedIn, setSignedIn] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const r = await fetch("/api/me", { credentials: "include", cache: "no-store" });
      setSignedIn(r.ok);
    } catch {
      setSignedIn(false);
    }
  }, []);

  // Check on mount, on route change, and when we get the custom event
  useEffect(() => { refreshAuth(); }, [refreshAuth, location.pathname]);

  useEffect(() => {
    const onAuthChanged = () => refreshAuth();
    const onFocusOrVisible = () => refreshAuth();
    window.addEventListener("auth:changed", onAuthChanged);
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);
    return () => {
      window.removeEventListener("auth:changed", onAuthChanged);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [refreshAuth]);

  async function handleSignOut() {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
    window.dispatchEvent(new Event("auth:changed"));
    nav("/");
  }

  function handleSignIn() {
    nav("/login");
  }

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 20px",
      borderBottom: "1px solid #eee",
      background: "#f7fbfc"
    }}>
      {/* Brand */}
      <div>
        <Link to="/" style={{ textDecoration: "none", fontWeight: 700, fontSize: 18, color: "#222" }}>
          Chris Brighouse
        </Link>
      </div>

      {/* Menu items (stay visible) */}
      <div style={{ display: "flex", gap: 16 }}>
        <Link to="/downloads" style={{ color: "#222", textDecoration: "none" }}>Downloads</Link>
        <Link to="/chat" style={{ color: "#222", textDecoration: "none" }}>Chat</Link>
        {/* add/remove more links as needed */}
      </div>

      {/* Auth button (single source of truth) */}
      <div>
        {signedIn ? (
          <button
            onClick={handleSignOut}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer"
            }}
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={handleSignIn}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #0cc",
              background: "#0cc",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
