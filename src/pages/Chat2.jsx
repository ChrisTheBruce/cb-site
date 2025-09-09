import React, { useState, useRef, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { streamChat2 } from "../services/chat2";

export default function Chat2() {
  const { user, loading, refresh } = useAuth();
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth');
    if (authToken && !user) {
      window.history.replaceState({}, '', '/chat2');
      refresh();
    }
  }, [user, refresh]);
  
  const [messages, setMessages] = useState([
    { role: "system", content: "You are a helpful assistant." },
  ]);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  
  const draftRef = useRef("");
  const endRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = useCallback(async (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || working) return;

    const userMsg = { role: "user", content };
    const history = [...messages, userMsg];

    setMessages(history);
    setInput("");
    draftRef.current = "";
    setWorking(true);

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      await streamChat2({
        messages: history,
        signal: abortRef.current.signal,
        onToken: (chunk) => {
          draftRef.current += chunk;
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              lastMsg.content = draftRef.current;
            } else {
              newMessages.push({ role: "assistant", content: draftRef.current });
            }
            return newMessages;
          });
        },
        onError: (error) => {
          const errorContent = (draftRef.current || "") + `\n[error: ${error}]`;
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === "assistant") {
              lastMsg.content = errorContent;
            } else {
              newMessages.push({ role: "assistant", content: errorContent });
            }
            return newMessages;
          });
        },
      });
    } catch (err) {
    } finally {
      setWorking(false);
      abortRef.current = null;
    }
  }, [messages, input, working]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", fontSize: 14, opacity: 0.8 }}>
        Loading your session…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>Chat2</h1>

      <div
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

      <form onSubmit={onSend} style={{ display: "flex", gap: 8, marginTop: 12 }}>
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
