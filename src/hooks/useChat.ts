// src/hooks/useChat.ts
import { useCallback, useRef, useState } from "react";
import { streamChat, type ChatMessage } from "@/services/chat";

export function useChat(initialModel = "gpt-4o") {
  const [model, setModel] = useState(initialModel);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "system", content: "You are a helpful assistant." },
  ]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (userText: string) => {
    const text = userText.trim();
    if (!text || streaming) return;

    // push user + empty assistant response
    const base = [...messages, { role: "user", content: text }, { role: "assistant", content: "" as string }];
    setMessages(base);

    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamChat({
        messages: base,
        model,
        signal: ctrl.signal,
        onToken: (chunk) => {
          setMessages((cur) => {
            const copy = cur.slice();
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: (last.content || "") + chunk };
            return copy;
          });
        },
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, model, streaming]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    if (streaming) return;
    setMessages([{ role: "system", content: "You are a helpful assistant." }]);
  }, [streaming]);

  return { model, setModel, messages, send, cancel, clear, streaming };
}
