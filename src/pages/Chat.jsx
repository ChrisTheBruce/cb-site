// src/pages/Chat.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { streamChat } from "../services/chat";

export default function Chat() {
  // ---- Auth guard inside the component ----
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
            const svc = info?.name || info?.service || "MCP service";
            const tool = info?.tool ? ` (${info.tool})` : "";
            // Always append a distinct MCP line that won't be overwritten by stream tokens
            copy.push({ role: "assistant", content: `MCP: ${svc}${tool}` });
            return copy;
          });
        },
        onToken: (chunk) => {
          draftRef.current += chunk;
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            const lastIsAssistant = lastMsg && lastMsg.role === "assistant";
            const lastIsMcpLine = lastIsAssistant && typeof lastMsg.content === 'string' && lastMsg.content.startsWith('MCP: ');
            if (lastIsAssistant && !lastIsMcpLine) {
              // Update existing streaming assistant message
              lastMsg.content = draftRef.current;
            } else {
              // Start a new assistant message for the stream (keep MCP line intact if present)
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

  // Simple small-screen detection to adjust layout
  const [isSmall, setIsSmall] = useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsSmall(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

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
    <div className="chat-page" style={{ maxWidth: 900, margin: "0 auto", padding: 16, paddingTop: 72, display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 140px)' }}>
      <div
        style={{
          display: "flex",
          flexDirection: isSmall ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isSmall ? "stretch" : "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h1 className="text-2xl font-bold">Chat</h1>
        <button
          onClick={() => navigate("/agent-designer")}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #0b5cff",
            background: "#0b5cff",
            color: "#fff",
            cursor: "pointer",
            width: isSmall ? "100%" : "auto",
          }}
        >
          Design an Agent
        </button>
      </div>

      <div
        className="transcript"
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          minHeight: isSmall ? 240 : 320,
          maxHeight: isSmall ? '60vh' : '65vh',
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

      <form
        onSubmit={onSend}
        className="composer"
        style={{
          display: "flex",
          flexDirection: isSmall ? 'column' : 'row',
          gap: 8,
          marginTop: 12,
          position: 'sticky',
          bottom: 0,
          background: '#f8fafc00',
          paddingBottom: isSmall ? 4 : 0,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={working}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", width: isSmall ? '100%' : undefined }}
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
            width: isSmall ? '100%' : undefined,
          }}
        >
          {working ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
