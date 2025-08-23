// components/Downloads.tsx
import React, { useEffect, useState } from 'react';
import DownloadLink from './DownloadLink';
import { getEmail, onEmailChange } from '../utils/emailStore';

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function EmailBadge({
  email,
  onCleared,
  className = '',
}: {
  email: string;
  onCleared: () => void;
  className?: string;
}) {
  const clearClientStorage = () => {
    // Kill common cookie names (best-effort)
    const names = ['session', 'cb_email', 'email', 'user_email'];
    const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
    const host = window.location.hostname;
    const parts = host.split('.');
    const domains = new Set<string>([
      host,
      parts.length >= 2 ? `.${parts.slice(-2).join('.')}` : host,
    ]);

    for (const name of names) {
      // no Domain=
      document.cookie = `${name}=; Expires=${expires}; Path=/; SameSite=Lax; Secure`;
      // with Domain= variants
      domains.forEach((d) => {
        document.cookie = `${name}=; Expires=${expires}; Path=/; Domain=${d}; SameSite=Lax; Secure`;
      });
    }

    // Clear common localStorage keys
    try {
      ['cb_email', 'email', 'user_email'].forEach((k) => localStorage.removeItem(k));
    } catch {}

    // Nudge any listeners that depend on storage changes
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: 'email', newValue: null }));
    } catch {}
  };

  const handleClear = async () => {
    // Clear server-side session (if used)
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    // Aggressive client cleanup
    clearClientStorage();
    onCleared();
  };

  if (!email) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm bg-gray-100 text-gray-800 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="font-medium">{email}</span>
      <button
        type="button"
        onClick={handleClear}
        className="ml-1 leading-none hover:opacity-70"
        aria-label="Clear email"
        title="Clear email"
      >
        ×
      </button>
    </div>
  );
}

export default function Downloads() {
  // IMPORTANT: read from the same client store the corner badge uses
  const [email, setEmail] = useState<string>(() => getEmail() || '');

  useEffect(() => {
    const off = onEmailChange((e: string | null | undefined) => setEmail(e || ''));
    return () => { try { off && off(); } catch {} };
  }, []);

  // Optional: marker to prove this is the file in use
  // useEffect(() => { console.log('Downloads page: email =', email); }, [email]);

  return (
    <section id="downloads" className="py-20 scroll-mt-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          {/* Email shown ABOVE the title, with an '×' to clear */}
          <EmailBadge email={email} onCleared={() => setEmail('')} className="mb-3" />

          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Resources &amp; Downloads
          </h2>

          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            Click to download more information on my services
          </p>
        </div>

        <div className="max-w-2xl mx-auto bg-gray-50 p-8 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-lg text-gray-800 mb-4">
            Click on an item to download it:
          </h3>

          <div className="not-prose mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
            <DownloadLink
              href="/assets/Chris-Brighouse-CV.pdf"
              download
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border font-medium hover:bg-slate-50"
            >
              <DownloadIcon className="h-5 w-5 flex-shrink-0" />
              <span>Download CV (PDF)</span>
            </DownloadLink>

            <DownloadLink
              href="/assets/Chris_Consulting_Services_SinglePage.pdf"
              download
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border font-medium hover:bg-slate-50"
            >
              <DownloadIcon className="h-5 w-5 flex-shrink-0" />
              <span>Services Overview (PDF)</span>
            </DownloadLink>
          </div>
        </div>
      </div>
    </section>
  );
}
