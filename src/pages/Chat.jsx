// src/pages/Chat.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { streamChat } from "../services/chat";

export default function Chat() {
  // ---- Auth guard inside the component ----
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

  const onSend = useCallback(async (e) => {
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
      await streamChat({
        messages: history,
        onMcp: (info) => {
          setMessages(prev => {
            const copy = prev.slice();
            const insertAt = Math.max(0, copy.length - (copy[copy.length - 1]?.role === "assistant" ? 1 : 0));
            const svc = info?.service || "MCP service";
            const tool = info?.tool ? ` (${info.tool})` : "";
            copy.splice(insertAt, 0, { role: "assistant", content: `MCP: ${svc}${tool}` });
            return copy;
          });
        },
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
      });
    } catch (err) {
      const fail = (draftRef.current || "") + `\n[error: ${String(err)}]`;
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content = fail;
        } else {
          newMessages.push({ role: "assistant", content: fail });
        }
        return newMessages;
      });
    } finally {
      setWorking(false);
    }
  }, [messages, input]);

  // While we don't know auth state yet, render nothing (or show a lightweight spinner)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-sm opacity-80">
        Loading your session…
      </div>
    );
  }

  // Not signed in? Go to login.
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="chat-page" style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 className="text-2xl font-bold">Chat</h1>
        <button
          onClick={() => {
            const popup = window.open('/chat2', '_blank', 'width=1000,height=700');
            if (popup) {
              const checkReady = () => {
                try {
                  if (popup.document && popup.document.readyState === 'complete') {
                    popup.postMessage({ type: 'AUTH_SYNC', authenticated: true }, window.location.origin);
                  } else {
                    setTimeout(checkReady, 100);
                  }
                } catch (e) {
                  setTimeout(checkReady, 100);
                }
              };
              setTimeout(checkReady, 500);
            }
          }}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #0b5cff",
            background: "#0b5cff",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Try Chat2
        </button>
      </div>

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
