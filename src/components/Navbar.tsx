import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Simple responsive menu: show hamburger on small screens
  const [open, setOpen] = useState(false);
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsSmall(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const onSignIn = () => {
    // Always route to login with next=/chat
    navigate(`/login?next=${encodeURIComponent("/chat")}`);
  };

  const onSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <header style={{ position: "sticky", top: 0, background: "#f7fbfb", borderBottom: "1px solid #e6e6e6", zIndex: 10 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/" style={{ fontWeight: 700, textDecoration: "none", color: "#111" }}>
            Chris Brighouse
          </Link>

          {/* Desktop nav */}
          {!isSmall && (
            <nav style={{ marginLeft: "auto", display: "flex", gap: 18, alignItems: "center" }}>
              <Link to="/work">Work</Link>
              <Link to="/experience">Experience</Link>
              <Link to="/contact">Contact</Link>
              <Link to="/downloads">Downloads</Link>
              {user && <Link to="/chat">Chat</Link>}
              <div style={{ marginLeft: 8 }}>
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
            </nav>
          )}

          {/* Mobile menu toggle */}
          {isSmall && (
            <button
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
              style={{ marginLeft: "auto", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}
            >
              {open ? "Close" : "Menu"}
            </button>
          )}
        </div>

        {/* Mobile drawer */}
        {isSmall && open && (
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <Link to="/work" onClick={() => setOpen(false)} style={{ padding: "10px 12px", borderRadius: 8, background: "#ffffff", border: "1px solid #e5e7eb" }}>Work</Link>
            <Link to="/experience" onClick={() => setOpen(false)} style={{ padding: "10px 12px", borderRadius: 8, background: "#ffffff", border: "1px solid #e5e7eb" }}>Experience</Link>
            <Link to="/contact" onClick={() => setOpen(false)} style={{ padding: "10px 12px", borderRadius: 8, background: "#ffffff", border: "1px solid #e5e7eb" }}>Contact</Link>
            <Link to="/downloads" onClick={() => setOpen(false)} style={{ padding: "10px 12px", borderRadius: 8, background: "#ffffff", border: "1px solid #e5e7eb" }}>Downloads</Link>
            {user && <Link to="/chat" onClick={() => setOpen(false)} style={{ padding: "10px 12px", borderRadius: 8, background: "#ffffff", border: "1px solid #e5e7eb" }}>Chat</Link>}
            <div>
              {user ? (
                <button onClick={onSignOut} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #222", background: "#fff", cursor: "pointer" }} disabled={loading}>
                  Sign out
                </button>
              ) : (
                <button onClick={onSignIn} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#09d6c6,#09c2f6)", color: "#fff", cursor: "pointer" }} disabled={loading}>
                  Sign in
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
