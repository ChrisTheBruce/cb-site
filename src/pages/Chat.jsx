import React, { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

export default function Chat() {
  const { user, loading, error, refresh } = useAuth();

  // Optional: if you land here after a login redirect and want to be extra sure:
  useEffect(() => {
    // If we somehow arrive with no user but not loading, try one refresh.
    if (!loading && !user) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-sm opacity-80">
        Loading your session…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-4 text-red-600">
        There was a problem loading your session. Please refresh the page.
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">You must sign in to use Chat.</h2>
        <p className="opacity-80">Your sign-in succeeded, but your session isn’t visible to the app yet. Try refreshing the page.</p>
      </div>
    );
  }

  // ===== Your existing chat UI below =====
  return (
    <div className="mx-auto max-w-3xl p-4">
      {/* Replace this block with your current chat component(s). */}
      <h1 className="text-2xl font-bold mb-4">Chat</h1>
      {/* <ChatComposer /> etc. */}
    </div>
  );
}
