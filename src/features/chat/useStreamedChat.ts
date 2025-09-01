import { useCallback, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "./types";
import { streamText } from "@/lib/api/chatClient";

const ENDPOINT = "/api/chat/stream";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function useStreamedChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (input: string) => {
    if (!input.trim() || isStreaming) return;
    setError(null);

    const userMsg: ChatMessage = { id: uid(), role: "user", content: input.trim() };
    const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "" };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Build payload using only role/content for history
      const payload = {
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      };

      for await (const chunk of streamText(ENDPOINT, payload, controller.signal)) {
        setMessages(prev => {
          // append to the last assistant message
          const copy = [...prev];
          const idx = copy.findIndex(m => m.id === assistantMsg.id);
          if (idx >= 0) copy[idx] = { ...copy[idx], content: copy[idx].content + chunk };
          return copy;
        });
      }
    } catch (e: any) {
      if (controller.signal.aborted) {
        setError(null); // user stopped
      } else {
        setError(e?.message || "Streaming failed");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, isStreaming]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return useMemo(() => ({ messages, send, stop, isStreaming, error }), [messages, send, stop, isStreaming, error]);
}
