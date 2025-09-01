import { useRef, useEffect, useState } from "react";
import { useStreamedChat } from "./useStreamedChat";

export default function Chat() {
  const { messages, send, stop, isStreaming, error } = useStreamedChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  return (
    <div className="mx-auto max-w-3xl p-4 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex-1 overflow-y-auto space-y-3 border rounded-lg p-4">
        {messages.length === 0 && (
          <div className="text-sm opacity-70">Start a chat…</div>
        )}
        {messages.map(m => (
          <div key={m.id} className="whitespace-pre-wrap">
            <span className="text-xs uppercase tracking-wide opacity-60 mr-2">
              {m.role === "user" ? "You" : "Assistant"}
            </span>
            <span>{m.content}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 border rounded-md px-3 py-2"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const v = input;
              setInput("");
              void send(v);
            }
          }}
          disabled={isStreaming}
        />
        {!isStreaming ? (
          <button
            className="border rounded-md px-4 py-2"
            onClick={() => { const v = input; setInput(""); void send(v); }}
            disabled={!input.trim()}
          >
            Send
          </button>
        ) : (
          <button className="border rounded-md px-4 py-2" onClick={stop}>
            Stop
          </button>
        )}
      </div>

      {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
    </div>
  );
}
