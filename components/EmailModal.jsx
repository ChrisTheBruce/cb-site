import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { requireValidEmail, setEmail } from "../utils/emailStore";

function Modal({ onResolve }) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape") onResolve(null); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onResolve]);

  const valid = requireValidEmail(value);
  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const email = value.trim();
    setEmail(email);
    onResolve(email);
  };

  const overlayStyle = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
  };
  const cardStyle = {
    background: "#fff", borderRadius: 12, width: "min(92vw, 420px)",
    padding: "20px 20px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
  };
  const inputStyle = {
    width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 8,
    border: `1px solid ${touched && !valid ? "#e5484d" : "#c7c7c7"}`, outline: "none"
  };
  const btnStyle = {
    marginTop: 12, padding: "10px 14px", fontSize: 14, borderRadius: 8,
    border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", cursor: "pointer"
  };
  const cancelStyle = {
    marginLeft: 8, padding: "10px 14px", fontSize: 14, borderRadius: 8,
    border: "1px solid #c7c7c7", background: "#fff", color: "#333", cursor: "pointer"
  };
  const hintStyle = { marginTop: 8, color: "#e5484d", fontSize: 12 };

  return (
    <div style={overlayStyle} onClick={() => onResolve(null)}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{margin: 0, fontSize: 18}}>Enter your email to download</h3>
        <p style={{margin: "8px 0 12px", fontSize: 13, color: "#555"}}>
          We’ll remember it and show it top-right as your account.
        </p>
        <form onSubmit={submit} noValidate>
          <input
            autoFocus
            type="email"
            placeholder="you@example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            style={inputStyle}
          />
          {touched && !valid && (
            <div role="alert" style={hintStyle}>Please enter a valid email address.</div>
          )}
          <div style={{display:"flex", justifyContent: "flex-end"}}>
            <button type="submit" style={btnStyle}>Continue</button>
            <button type="button" onClick={() => onResolve(null)} style={cancelStyle}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function showEmailModal() {
  // Ensure a portal root exists
  let host = document.getElementById("modal-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "modal-root";
    document.body.appendChild(host);
  }

  const container = document.createElement("div");
  host.appendChild(container);
  const root = createRoot(container);

  return new Promise((resolve) => {
    const cleanup = () => {
      try { root.unmount(); } catch {}
      try { host.removeChild(container); } catch {}
    };
    const onResolve = (value) => { cleanup(); resolve(value); };
    root.render(<Modal onResolve={onResolve} />);
  });
}
