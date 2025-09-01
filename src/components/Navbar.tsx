// Navbar.tsx — full replacement
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

export default function Navbar() {
  const nav = useNavigate();
  const location = useLocation();
  const [signedIn, setSignedIn] = useState(false);

  async function refreshAuth() {
    try {
      const r = await fetch("/api/me", { credentials: "include" });
      setSignedIn(r.ok);
    } catch {
      setSignedIn(false);
    }
  }

  // Check auth on mount and whenever the route changes
  useEffect(() => {
    refreshAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Listen for global auth changes (emitted after sign in/out)
  useEffect(() => {
    const onAuthChanged = () => refreshAuth();
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, []);

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

  const links = [
    { to: "/work", label: "Work" },
    { to: "/experience", label: "Experience" },
    { to: "/contact", label: "Contact" },
    { to: "/downloads", label: "Downloads" },
  ];

  const linkStyle: React.CSSProperties = { color: "#222", textDecoration: "none" };

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 20px",
        borderBottom: "1px solid #eee",
        background: "#f7fbfc",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Brand */}
      <div>
        <Link to="/" style={{ textDecoration: "none", fontWeight: 700, fontSize: 18, color: "#222" }}>
          Chris Brighouse
        </Link>
      </div>

      {/* Menu */}
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        {links.map((l) => (
          <Link key={l.to} to={l.to} style={linkStyle}>
            {l.label}
          </Link>
        ))}
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
              cursor: "pointer",
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
              cursor: "pointer",
            }}
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
