import * as React from "react";
import EmailBadge from "@/components/EmailBadge";
import { useDlEmail } from "@/hooks/useDlEmail";

/**
 * SAFE client-side debug logger (no Worker env import on the client).
 * Set window.__DEBUG__ = true in DevTools to see logs.
 */
const DBG = (...args: any[]) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = (window as any) || {};
    if (w.__DEBUG__) console.debug("[Downloads]", ...args);
  } catch {
    /* no-op */
  }
};

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

/**
 * Adjust this to match your Worker/Pages function route,
 * or set VITE_DOWNLOAD_NOTIFY_ENDPOINT in your env.
 */
const NOTIFY_ENDPOINT =
  (import.meta as any)?.env?.VITE_DOWNLOAD_NOTIFY_ENDPOINT || "/api/download-notify";

type DownloadItem = {
  title: string;
  path: string;
  description?: string;
  size?: string;
};

// Update these paths/titles to match your assets if needed.
const items: DownloadItem[] = [
  { title: "Chris-Brighouse-CV.pdf", path: "/assets/Chris-Brighouse-CV.pdf" },
  {
    title: "Chris_Consulting_Services_SinglePage.pdf",
    path: "/assets/Chris_Consulting_Services_SinglePage.pdf",
  },
];

async function notifyDownload(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const body = JSON.stringify(payload);

  // Try Beacon first (best during page unload)
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const ok = navigator.sendBeacon(
        endpoint,
        new Blob([body], { type: "application/json" })
      );
      if (ok) {
        DBG("notify sent via sendBeacon");
        return true;
      }
    }
  } catch (err) {
    DBG("sendBeacon failed", err);
  }

  // Fallback: fetch with keepalive
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
    DBG("notify sent via fetch keepalive");
    return true;
  } catch (err) {
    DBG("keepalive fetch failed", err);
    return false;
  }
}

export default function Downloads() {
  // Hook for capturing and exposing email on the page
  const dl = useDlEmail() as {
    email?: string | null;
    ensureEmail?: () => Promise<string | false>;
  };

  const email = dl?.email ?? null;

  async function onClickDownload(path: string, title?: string) {
    try {
      // Ensure we have an email before proceeding
      const ensured = (await dl?.ensureEmail?.()) || false;
      if (!ensured) return;

      // Build a small payload for the notify endpoint
      const payload = {
        path,
        title,
        email: ensured, // string email returned by ensureEmail
        ts: Date.now(),
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      };

      // Fire-and-forget notify BEFORE navigating
      void notifyDownload(NOTIFY_ENDPOINT, payload);

      // Start the download last
      window.location.href = path;
    } catch (err) {
      DBG("onClickDownload error", err);
      // Even if notify fails, still attempt the download
      try {
        window.location.href = path;
      } catch {
        /* no-op */
      }
    }
  }

  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Centered email above the title */}
        <div className="mb-6 flex justify-center">
          <EmailBadge email={email ?? undefined} />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Downloads
          </h1>
          <p className="mt-2 text-gray-600">
            Click to download. We’ll send a short notification to our system so we
            can support you better.
          </p>
        </div>

        <div className="mt-10">
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((it) => (
              <button
                key={it.path}
                type="button"
                onClick={() => onClickDownload(it.path, it.title)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 bg-white hover:bg-gray-100 shadow-sm"
              >
                <DownloadIcon className="h-4 w-4" />
                <span className="text-left">
                  <span className="block">{it.title}</span>
                  {it.description && (
                    <span className="block text-xs text-gray-500">{it.description}</span>
                  )}
                  {it.size && (
                    <span className="block text-xs text-gray-400">Size: {it.size}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
