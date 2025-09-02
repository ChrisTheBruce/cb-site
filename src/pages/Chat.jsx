import { useState, useRef } from 'react';
import { streamChat } from '../services/chat';

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'You are a helpful assistant.' }
  ]);
  const [input, setInput] = useState('');
  const [working, setWorking] = useState(false);
  const draftRef = useRef('');

  async function onSend(e) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;

    const userMsg = { role: 'user', content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    draftRef.current = '';
    setWorking(true);

    try {
      for await (const chunk of streamChat(history /* , { model: 'gpt-4o-mini' } */)) {
        draftRef.current += chunk;
        setMessages([...history, { role: 'assistant', content: draftRef.current }]);
      }
    } catch (err) {
      const fail = (draftRef.current || '') + `\n[error: ${String(err)}]`;
      setMessages([...history, { role: 'assistant', content: fail }]);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="chat-page">
      <div className="transcript">
        {messages.filter(m => m.role !== 'system').map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.content}</div>
        ))}
      </div>
      <form onSubmit={onSend} className="composer">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={working}
        />
        <button disabled={working || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
