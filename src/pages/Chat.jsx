// src/pages/Chat.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { streamText } from "../services/chat";

export default function Chat() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState([]); // [{ from: "user"|"bot", text }]
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const endRef = useRef(null);

  // Require auth (re-uses your existing /api/me)
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/me", { credentials: "include" });
      if (!r.ok) {
        nav("/login");
        return;
      }
      setReady(true);
    })();
  }, [nav]);

  // Auto-scroll on updates
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  async function handleSend(e) {
    e?.preventDefault?.();
    const prompt = input.trim();
    if (!prompt || streaming) return;

    setInput("");
    setError("");

    // Add user + assistant placeholder
    const userMsg = { from: "user", text: prompt };
    const botMsg = { from: "bot", text: "" };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setStreaming(true);

    // Build payload from history (role/content only)
    const history = [...messages, userMsg].map((m) => ({
      role: m.from === "user" ? "user" : "assistant",
      content: m.text,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // IMPORTANT: hit the streaming endpoint we added in Stage 1
      for await (const chunk of streamText("/api/chat/stream", { messages: history }, controller.signal)) {
        setMessages((prev) => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].from === "bot") {
              copy[i] = { ...copy[i], text: (copy[i].text || "") + chunk };
              break;
            }
          }
          return copy;
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err?.message || "Streaming failed");
        setMessages((prev) => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].from === "bot") {
              copy[i] = { ...copy[i], text: (copy[i].text || "") + "\n[Error: stream ended]" };
              break;
            }
          }
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  if (!ready) return null;

  return (
    <div style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <h1>Chat</h1>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 16,
          height: 420,
          overflowY: "auto",
          marginBottom: 16,
          background: "#fafafa",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: "#666" }}>No messages yet. Start the conversation below.</div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 10,
                textAlign: m.from === "user" ? "right" : "left",
                whiteSpace: "pre-wrap",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "8px 12px",
                  borderRadius: 12,
                  background: m.from === "user" ? "#0cc" : "#eee",
                  color: m.from === "user" ? "#fff" : "#111",
                }}
              >
                {m.text}
              </span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          disabled={streaming}
          onChange={(e) => setInput(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #ccc",
            borderRadius: 8,
            fontSize: 15,
          }}
          placeholder="Type a message..."
        />
        {!streaming ? (
          <button
            type="submit"
            disabled={!input.trim()}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #0cc",
              background: "#0cc",
              color: "#fff",
              cursor: !input.trim() ? "default" : "pointer",
            }}
          >
            Send
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #f66",
              background: "#f66",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Stop
          </button>
        )}
      </form>

      {error && <div style={{ marginTop: 8, color: "#c00", fontSize: 14 }}>{error}</div>}
    </div>
  );
}
