import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const onSignIn = () => {
    // Always route to login with next=/Chat
    navigate(`/login?next=${encodeURIComponent("/Chat")}`);
  };

  const onSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <header style={{ position: "sticky", top: 0, background: "#f7fbfb", borderBottom: "1px solid #e6e6e6", zIndex: 10 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ fontWeight: 700, textDecoration: "none", color: "#111" }}>
          Chris Brighouse
        </Link>

        <nav style={{ marginLeft: "auto", display: "flex", gap: 18 }}>
          <Link to="/Work">Work</Link>
          <Link to="/Experience">Experience</Link>
          <Link to="/Contact">Contact</Link>
          <Link to="/Downloads">Downloads</Link>
        </nav>

        <div style={{ marginLeft: 16 }}>
          {user ? (
            <button onClick={onSignOut} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #222", background: "#fff", cursor: "pointer" }} disabled={loading}>
              Sign out
            </button>
          ) : (
            <button onClick={onSignIn} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#09d6c6,#09c2f6)", color: "#fff", cursor: "pointer" }} disabled={loading}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
