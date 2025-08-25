// Navbar.tsx — swap in completely
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Navbar() {
  const nav = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  // Check if logged in
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/me", { credentials: "include" });
        setSignedIn(r.ok);
      } catch {
        setSignedIn(false);
      }
    })();
  }, []);

  async function handleSignOut() {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {}
    setSignedIn(false);
    nav("/");
  }

  function handleSignIn() {
    nav("/login");
  }

  return (
    <nav style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #eee" }}>
      <div>
        <Link to="/" style={{ textDecoration: "none", fontWeight: "bold", fontSize: 18, color: "#222" }}>
          Chris Brighouse
        </Link>
      </div>
      <div>
        {signedIn ? (
          <button
            onClick={handleSignOut}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
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
              padding: "6px 12px",
              borderRadius: 6,
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
