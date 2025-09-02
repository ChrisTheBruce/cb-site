// src/services/chat.ts
export type ChatMessage = { role: 'system'|'user'|'assistant'; content: string };

export async function* streamChat(
  messages: ChatMessage[],
  opts: { model?: string } = {}
) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...opts })
  });
  if (!res.ok || !res.body) throw new Error(`Chat failed: ${res.status}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    yield dec.decode(value, { stream: true });
  }
}
