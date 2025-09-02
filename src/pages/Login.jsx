// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { user, loading, signIn, error } = useAuth();
  const [formErr, setFormErr] = useState(null);
  const [username, setUsername] = useState("chris");
  const [password, setPassword] = useState("badcommand");
  const [working, setWorking] = useState(false);
  const nav = useNavigate();

  // Already signed in? Go straight to chat.
  if (!loading && user) {
    return <Navigate to="/chat" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormErr(null);
    setWorking(true);
    try {
      await signIn(username, password);
      // At this point /api/me should return 200; navigate to chat.
      nav("/chat", { replace: true });
    } catch (e) {
      setFormErr(String(e?.message || e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="login-page">
      <h1>Sign in</h1>

      {(formErr || error) && <div className="error">{formErr || error}</div>}

      <form onSubmit={onSubmit}>
        <label>
          Username
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            disabled={working}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            disabled={working}
          />
        </label>
        <button disabled={working}>{working ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
