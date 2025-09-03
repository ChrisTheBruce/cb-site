import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";

export default function Chat() {
  // Gate: require auth (keeps consistent with login gating)
  const { isAuthenticated, loading } = useAuth();
  const { model, setModel, messages, send, cancel, clear, streaming } = useChat("gpt-4o");
  const [input, setInput] = useState("");

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (!isAuthenticated) return <div style={{ padding: 16 }}>You must sign in to use Chat.</div>;

  return (
    <div style={{ maxWidth: 860, margin: "1.5rem auto", padding: "0 1rem" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>Model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
          </select>
        </label>
        {streaming ? (
          <button onClick={cancel}>Stop</button>
        ) : (
          <button onClick={clear}>Clear</button>
        )}
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          background: "#fff",
          minHeight: 280,
          marginBottom: 12,
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
                borderRadius: 6,
                margin: "6px 0",
                background: m.role === "user" ? "#f6f6f6" : "transparent",
                border: m.role === "user" ? "1px solid #eee" : "none",
              }}
            >
              <strong style={{ color: "#666" }}>
                {m.role === "user" ? "You" : "Assistant"}
              </strong>
              <div>{m.content}</div>
            </div>
          ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = input;
          setInput("");
          send(t);
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          rows={3}
          style={{ flex: 1, padding: 8 }}
          disabled={streaming}
        />
        <button type="submit" disabled={streaming || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
