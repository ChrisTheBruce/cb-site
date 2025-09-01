// src/components/Downloads.tsx (full replacement)
import * as React from "react";
import EmailBadge from "@/components/EmailBadge";
import { useDlEmail } from "@/hooks/useDlEmail";

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Downloads() {
  const { email, submitEmail, notify } = useDlEmail();

  async function ensureEmail(): Promise<string | null> {
    if (email && EMAIL_REGEX.test(email)) return email;
    const entered = (prompt("Enter your email to access downloads:") || "").trim();
    if (!EMAIL_REGEX.test(entered)) {
      if (entered) alert("Please enter a valid email address.");
      return null;
    }
    const resp = await submitEmail(entered);
    if (!(resp as any).ok) {
      alert((resp as any).error || "Email not accepted");
      return null;
    }
    return entered;
  }

  async function onClickDownload(path: string, title?: string) {
    const ok = await ensureEmail();
    if (!ok) return;

    // Kick off the real download
    window.location.href = path;

    // Best-effort notify; do not block the UX
    try {
      const r = await notify(path, title);
      if ((r as any).warn === "mail_notify_failed") {
        console.warn("Support email notify failed server-side.");
      }
    } catch { /* ignore */ }
  }

  // Adjust these paths to match where your PDFs are served from
  const items = [
    { title: "Chris-Brighouse-CV.pdf", path: "/assets/Chris-Brighouse-CV.pdf" },
    { title: "Chris_Consulting_Services_SinglePage.pdf", path: "/assets/Chris_Consulting_Services_SinglePage.pdf" },
  ];

  return (
    <section id="downloads" className="py-20 scroll-mt-20 bg-white">
      <div className="container mx-auto px-6">
        <EmailBadge className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-800" />

        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Resources &amp; Downloads</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">Click to download more information on my services</p>
        </div>

        <div className="max-w-2xl mx-auto bg-gray-50 p-8 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-lg text-gray-800 mb-4">Click on an item to download it:</h3>

          <div className="not-prose mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
            {items.map(it => (
              <button
                key={it.path}
                type="button"
                onClick={() => onClickDownload(it.path, it.title)}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-gray-800 bg-white hover:bg-gray-100"
              >
                <DownloadIcon className="h-4 w-4" />
                {it.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
