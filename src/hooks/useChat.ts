// src/hooks/useChat.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat, type ChatMessage } from "@/services/chat";

const STORE_KEY = "cb_chat_state_v1";

type ChatState = {
  model: string;
  temperature: number;
  messages: ChatMessage[];
};

function loadState(): ChatState | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as ChatState) : null;
  } catch {
    return null;
  }
}

function saveState(s: ChatState) {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {}
}

export function useChat(defaultModel = "gpt-4o", defaultTemperature = 0.5) {
  const initial =
    loadState() || {
      model: defaultModel,
      temperature: defaultTemperature,
      messages: [{ role: "system", content: "You are a helpful assistant." } as ChatMessage],
    };

  const [model, setModel] = useState<string>(initial.model);
  const [temperature, setTemperature] = useState<number>(initial.temperature);
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveState({ model, temperature, messages });
  }, [model, temperature, messages]);

  const send = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      if (!text || streaming) return;
      setError("");

      // Push user + empty assistant for streamed answer
      const base = [...messages, { role: "user", content: text }, { role: "assistant", content: "" as string }];
      setMessages(base);

      setStreaming(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        await streamChat({
          messages: base,
          model,
          temperature,
          signal: ctrl.signal,
          // NEW: announce MCP usage as a separate assistant line before the streamed answer
          onMcp: (info) => {
            setMessages((cur) => {
              // Insert just before the last (streaming) assistant bubble
              const copy = cur.slice();
              const insertAt = Math.max(0, copy.length - 1);
              const svc = info?.service || "MCP service";
              const tool = info?.tool ? ` (${info.tool})` : "";
              copy.splice(insertAt, 0, { role: "assistant", content: `MCP: ${svc}${tool}` });
              return copy;
            });
          },
          onToken: (chunk) => {
            setMessages((cur) => {
              const copy = cur.slice();
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: (last.content || "") + chunk };
              return copy;
            });
          },
        });
      } catch (e: any) {
        setError(e?.message || "Chat failed.");
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, model, temperature, streaming]
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const clear = useCallback(() => {
    if (streaming) return;
    setMessages([{ role: "system", content: "You are a helpful assistant." }]);
    setError("");
  }, [streaming]);

  const retryLast = useCallback(() => {
    if (streaming) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        const text = messages[i].content;
        const trimmed = messages.slice(0, i + 1);
        setMessages(trimmed);
        void send(text);
        break;
      }
    }
  }, [messages, streaming, send]);

  return {
    model,
    setModel,
    temperature,
    setTemperature,
    messages,
    send,
    cancel,
    clear,
    retryLast,
    streaming,
    error,
  };
}
