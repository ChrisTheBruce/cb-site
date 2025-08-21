import React, { useEffect, useState } from "react";
import { getEmail, onEmailChange } from "../utils/emailStore";

export default function UserAccountBadge() {
  const [email, setEmail] = useState(() => getEmail());

  useEffect(() => {
    const off = onEmailChange(setEmail);
    return () => off?.();
  }, []);

  if (!email) return null;

  const wrap = {
    position: "fixed",
    top: 8,
    right: 10,
    padding: "4px 8px",
    fontSize: 12,
    color: "#555",
    background: "rgba(255,255,255,0.85)",
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    zIndex: 999
  };

  return (
    <div style={wrap} title="Signed in for downloads">
      {email}
    </div>
  );
}
