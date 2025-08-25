// components/Downloads.tsx
import React from "react";
import { useDownloadEmail } from "../src/context/DownloadEmailContext";

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

const EMAIL_COOKIE = "cb_dl_email";
const ONE_YEAR = 60 * 60 * 24 * 365;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setEmailCookie(email: string) {
  const secure = location.protocol === "https:" ? "Secure; " : "";
  document.cookie = `${EMAIL_COOKIE}=${encodeURIComponent(email)}; Max-Age=${ONE_YEAR}; Path=/; ${secure}SameSite=Lax`;
}

export default function Downloads() {
  const { email, setEmail, clearEmail } = useDownloadEmail();

  async function ensureEmail(): Promise<string | null> {
    if (email && emailRegex.test(email)) return email;
    const entered = (prompt("Enter your email to access downloads:") || "").trim();
    if (!emailRegex.test(entered)) {
      alert("Please enter a valid email address.");
      return null;
    }
    await setEmail(entered);       // context
    setEmailCookie(entered);       // cookie (persists across reloads)
    return entered;
  }

  async function notifyAndDownload(fileName: string) {
    const userEmail = await ensureEmail();
    if (!userEmail) return;

    const href = `/downloads/${fileName}`;
    const fileUrl = new URL(href, location.origin).href;

    try {
      await fetch("/api/notify_download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userEmail, fileName, fileUrl }),
      });
    } catch {
      // best-effort only
    }

    window.location.href = href;
  }

  return (
    <section id="downloads" className="py-20 scroll-mt-20 bg-white">
      <div className="container mx-auto px-6">
        {/* INLINE BADGE — shown above the page title */}
        {email && (
          <div
            className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-800"
            role="status"
            aria-live="polite"
          >
            <span>downloads: {email}</span>
            <button
              type="button"
              onClick={clearEmail}
              className="ml-1 leading-none hover:opacity-70"
              aria-label="Clear download email"
              title="Clear download email"
            >
              ×
            </button>
          </div>
        )}

        <div className="text-center mb-12">
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
            <button
              type="button"
              onClick={() => notifyAndDownload("Chris-Brighouse-CV.pdf")}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-gray-800 bg-white hover:bg-gray-100"
            >
              <DownloadIcon className="h-4 w-4" />
              Chris-Brighouse-CV.pdf
            </button>

            <button
              type="button"
              onClick={() => notifyAndDownload("Chris_Consulting_Services_SinglePage.pdf")}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-gray-800 bg-white hover:bg-gray-100"
            >
              <DownloadIcon className="h-4 w-4" />
              Chris_Consulting_Services_SinglePage.pdf
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
