// Chat.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Chat() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Ensure user is authenticated before loading chat
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

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    setSending(true);

    // Add user message to local list
    setMessages((prev) => [...prev, { from: "user", text: msg }]);

    try {
      // Example call to your backend/chat API
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg }),
      });
      const data = await r.json().catch(() => null);
      if (data?.reply) {
        setMessages((prev) => [...prev, { from: "bot", text: data.reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, { from: "bot", text: "Error: failed to send message" }]);
    } finally {
      setSending(false);
    }
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
          height: 400,
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
      </div>

      <form onSubmit={sendMessage} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          disabled={sending}
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
        <button
          type="submit"
          disabled={sending}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #0cc",
            background: sending ? "#9ee" : "#0cc",
            color: "#fff",
            cursor: sending ? "default" : "pointer",
          }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
