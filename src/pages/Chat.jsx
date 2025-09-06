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
  
   // Chat state
  const [messages, setMessages] = useState([
    { role: "system", content: "You are a helpful assistant." },
  ]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);

  // Streaming helpers
  const draftRef = useRef("");
  const endRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // While we don't know auth state yet, render nothing (or a spinner)
  if (loading) return null;
  // Not signed in? Go to login.
  if (!user) return <Navigate to="/login" replace />;

  async function onSend(e) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;

    const userMsg = { role: "user", content };
    const history = [...messages, userMsg];

    setMessages(history);
    setInput("");
    draftRef.current = "";
    setWorking(true);

    try {
      // Stream assistant tokens as they arrive
      for await (const chunk of streamChat(history // , { model: 'gpt-4o-mini' } )) {
        draftRef.current += chunk;
        setMessages([...history, { role: "assistant", content: draftRef.current }]);
      }
    } catch (err) {
      const fail = (draftRef.current || "") + `\n[error: ${String(err)}]`;
      setMessages([...history, { role: "assistant", content: fail }]);
    } finally {
      setWorking(false);
    }
  }

    return (
    <div className="chat-page" style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Chat</h1>

      <div
        className="transcript"
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          minHeight: 320,
          maxHeight: "60vh",
          overflowY: "auto",
          background: "#fff",
        }}
      >
        {messages
          .filter((m) => m.role !== "system")
          .map((m, i) => (
            <div
              key={i}
              className={`msg ${m.role}`}
              style={{
                whiteSpace: "pre-wrap",
                padding: "8px 10px",
                margin: "8px 0",
                borderRadius: 8,
                background: m.role === "user" ? "#eef6ff" : "#f7f7f7",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {m.content}
            </div>
          ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSend} className="composer" style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={working}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button
          disabled={working || !input.trim()}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #0b5cff",
            background: working ? "#94b4ff" : "#0b5cff",
            color: "#fff",
            cursor: working ? "default" : "pointer",
          }}
        >
          {working ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}

/*

// src/pages/Chat.jsx
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { streamChat } from "../services/chat";

export default function Chat() {
  // ---- Auth guard must be INSIDE the component ----
  const { user, loading } = useAuth();

  // Chat state
  const [messages, setMessages] = useState([
    { role: "system", content: "You are a helpful assistant." },
  ]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);

  // Streaming helpers
  const draftRef = useRef("");
  const endRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // While we don't know auth state yet, render nothing (or a spinner)
  if (loading) return null;
  // Not signed in? Go to login.
  if (!user) return <Navigate to="/login" replace />;

  async function onSend(e) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;

    const userMsg = { role: "user", content };
    const history = [...messages, userMsg];

    setMessages(history);
    setInput("");
    draftRef.current = "";
    setWorking(true);

    try {
      // Stream assistant tokens as they arrive
      for await (const chunk of streamChat(history // , { model: 'gpt-4o-mini' } )) {
        draftRef.current += chunk;
        setMessages([...history, { role: "assistant", content: draftRef.current }]);
      }
    } catch (err) {
      const fail = (draftRef.current || "") + `\n[error: ${String(err)}]`;
      setMessages([...history, { role: "assistant", content: fail }]);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="chat-page" style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>Chat</h1>

      <div
        className="transcript"
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          minHeight: 320,
          maxHeight: "60vh",
          overflowY: "auto",
          background: "#fff",
        }}
      >
        {messages
          .filter((m) => m.role !== "system")
          .map((m, i) => (
            <div
              key={i}
              className={`msg ${m.role}`}
              style={{
                whiteSpace: "pre-wrap",
                padding: "8px 10px",
                margin: "8px 0",
                borderRadius: 8,
                background: m.role === "user" ? "#eef6ff" : "#f7f7f7",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {m.content}
            </div>
          ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSend} className="composer" style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={working}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button
          disabled={working || !input.trim()}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #0b5cff",
            background: working ? "#94b4ff" : "#0b5cff",
            color: "#fff",
            cursor: working ? "default" : "pointer",
          }}
        >
          {working ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
*/
