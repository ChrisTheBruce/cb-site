// src/components/EmailBadge.tsx
import React, { useState } from 'react';
import { clearDownloadEmail } from '@/services/downloads';

type Props = {
  email: string | null;
  onCleared?: () => void;   // parent can refresh state after clear
};

export default function EmailBadge({ email, onCleared }: Props) {
  const [busy, setBusy] = useState(false);
  if (!email) return null;

  const handleClear = async () => {
    try {
      setBusy(true);
      await clearDownloadEmail();
      onCleared?.(); // tell parent to drop email from state/context
    } catch (e) {
      console.error('Failed to clear download email', e);
      alert('Sorry, failed to clear the saved email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: busy ? 0.6 : 1 }}>
      <span>Signed in for downloads: <strong>{email}</strong></span>
      <button
        onClick={handleClear}
        disabled={busy}
        title="Clear saved email"
        style={{
          border: '1px solid #ccc',
          background: 'transparent',
          padding: '2px 6px',
          borderRadius: 6,
          cursor: busy ? 'default' : 'pointer'
        }}
      >
        {busy ? 'Clearing…' : 'Clear'}
      </button>
    </div>
  );
}

/*
import * as React from "react";
import { useDlEmail } from "@/hooks/useDlEmail";

type Props = {
  className?: string;
  //  ** Optional controlled props (prefer passing these from the page for live updates) *
  email?: string | null;
  onClear?: () => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
};

export default function EmailBadge(props: Props) {
  // If the parent passes props, use them; otherwise fall back to the hook.
  const fallback = useDlEmail();
  const email = props.email ?? fallback.email;
  const clear = props.onClear ?? fallback.clear;
  const busy = props.busy ?? fallback.busy;
  const error = props.error ?? fallback.error;

  if (!email) return null;

  return (
    <div className={props.className ?? "text-sm text-gray-800"}>
      <span>Signed in for downloads as </span>
      <strong>{email}</strong>
      <button
        onClick={() => void clear()}
        disabled={!!busy}
        className="ml-2 underline underline-offset-2"
        aria-label="Clear download email"
        title="Clear download email"
      >
        (clear)
      </button>
      {error && <span className="ml-2 text-red-600">{error}</span>}
    </div>
  );
}
*/