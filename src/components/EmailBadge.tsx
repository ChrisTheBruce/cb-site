// src/components/EmailBadge.tsx (full replacement)
import * as React from "react";
import { useDlEmail } from "@/hooks/useDlEmail";

type Props = { className?: string };

export default function EmailBadge({ className }: Props) {
  const { email, clear, busy, error } = useDlEmail();

  if (!email) return null;
  return (
    <div className={className ?? "text-xs opacity-80 mb-2"}>
      <span>Signed in for downloads as </span>
      <strong>{email}</strong>
      <button
        onClick={() => clear()}
        disabled={busy}
        style={{ marginLeft: 8, fontSize: "0.85em" }}
        aria-label="Clear download email"
        title="Clear download email"
      >
        (clear)
      </button>
      {error && <span style={{ color: "crimson", marginLeft: 8 }}>{error}</span>}
    </div>
  );
}
