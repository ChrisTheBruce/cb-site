import * as React from "react";
import { useDlEmail } from "@/hooks/useDlEmail";

type Props = {
  className?: string;
  /** Optional controlled props (prefer passing these from the page for live updates) */
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
