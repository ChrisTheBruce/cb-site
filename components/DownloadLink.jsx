import React from "react";
import { getEmail } from "../utils/emailStore";
import { showEmailModal } from "./EmailModal";

// Fire-and-forget server notification. Prefer sendBeacon; fallback to fetch.
function notifyDownload(email, path) {
  const payload = JSON.stringify({
    email,
    path,
    ts: new Date().toISOString(),
    ua: typeof navigator !== "undefined" ? navigator.userAgent : ""
  });
  payload
  try {
    if (navigator?.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/notify-download", blob)) return;
    }
  } catch {}
  try {
    fetch("/api/notify-download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export default function DownloadLink({ href, children, ...rest }) {
  const onClick = async (e) => {
    // Let modified-clicks behave normally (open in new tab, save link, etc.)
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const email = getEmail();
    if (!email) {
      e.preventDefault();
      const entered = await showEmailModal();
      if (!entered) return; // user cancelled
      notifyDownload(entered, href);
      window.location.assign(href);
      return;
    }
    notifyDownload(email, href);
  };

  return (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
