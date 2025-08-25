// components/EmailModal.jsx
// Deprecated: EmailModal is no longer used.
// The new DownloadButton component handles email prompting directly.

export function showEmailModal() {
  console.warn("EmailModal is deprecated — use <DownloadButton> instead.");
  return Promise.resolve(null);
}

export default function EmailModal() {
  return null; // no UI
}
