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
  // Assumes the page is wrapped in <DownloadEmailProvider> higher up (App/layout)
  const { email, setEmail, clearEmail } = useDownloadEmail();

  // Fixed top-right badge (like before)
  const TopRightEmailBadge = () =>
    email ? (
      <div
        style={{
          position: "fixed",
          top: 8,
          right: 12,
          fontSize: 12,
          opacity: 0.85,
          background: "rgba(248,250,252,0.95)", // near Tailwind slate-50
          border: "1px solid rgba(203,213,225,0.9)", // slate-300
          borderRadius: 9999,
          padding: "4px 10px",
          zIndex: 50,
        }}
        role="status"
        aria-live="polite"
      >
        <span>downloads: {email}</span>
        <button
          type="button"
          onClick={() => {
            clearEmail();
          }}
          style={{ marginLeft: 8, fontSize: 12 }}
          title="Clear download email"
          aria-label="Clear download email"
        >
          ×
        </button>
      </div>
    ) : null;

  async function ensureEmail(): Promise<string | null> {
    if (email && emailRegex.test(email)) return email;
    const entered = (prompt("Enter your email to access downloads:") || "").trim();
    if (!emailRegex.test(entered)) {
      alert("Please enter a valid email address.");
      return null;
    }
    // Update context and cookie so it persists across pages
    setEmail(entered);
    setEmailCookie(entered);
    return entered;
  }

  async function notifyAndDownload(fileName: string) {
    const userEmail = await ensureEmail();
    if (!userEmail) return;

    const href = `/downloads/${fileName}`;
    const fileUrl = new URL(href, location.origin).href;

    // Notify backend (best-effort)
    try {
      await fetch("/api/notify_download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userEmail, fileName, fileUrl }),
      });
    } catch {
      // ignore notify failures; still allow download
    }

    // Proceed with the actual download
    window.location.href = href;
  }

  return (
    <section id="downloads" className="py-20 scroll-mt-20 bg-white">
      {/* Top-right email badge */}
      <TopRightEmailBadge />

      <div className="container mx-auto px-6">
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
