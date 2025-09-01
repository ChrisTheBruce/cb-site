import { useEffect, useState } from 'react';
import { getEmailCookie, clearEmailCookie } from '../utils/emailCookie';

export default function EmailBadge({ className = '' }) {
  const [email, setEmail] = useState(getEmailCookie());

  useEffect(() => {
    const onChange = () => setEmail(getEmailCookie());
    window.addEventListener('cb-email-changed', onChange);
    return () => window.removeEventListener('cb-email-changed', onChange);
  }, []);

  if (!email) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-gray-100 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="font-medium">{email}</span>
      <button
        type="button"
        onClick={() => {
          clearEmailCookie();
          setEmail('');
        }}
        className="ml-1 leading-none"
        aria-label="Clear email"
        title="Clear email"
      >
        ×
      </button>
    </div>
  );
}
