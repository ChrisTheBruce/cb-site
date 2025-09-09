import React from "react";
import DownloadButton from "./DownloadButton";

// This replacement keeps the same signature as a link, but wraps DownloadButton.
// Use <DownloadLink filename="file.pdf">Label</DownloadLink>
export default function DownloadLink({ href, children, ...rest }) {
  // Extract filename from href (strip /assets/ if present)
  const filename = href.replace(/^\/?assets\//, "").replace(/^\//, "");

  return (
    <DownloadButton filename={filename} {...rest}>
      {children}
    </DownloadButton>
  );
}
