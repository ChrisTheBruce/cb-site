// Minimal, safe-ish Markdown to HTML converter for headings, lists, code, bold/italic.
// Not a full implementation; avoids external deps.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderBasicMarkdown(md: string): string {
  if (!md) return "";

  // Handle fenced code blocks first by splitting
  const parts = md.split(/```/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (i % 2 === 1) {
      // code block
      out.push(`<pre><code>${escapeHtml(seg.trim())}</code></pre>`);
    } else {
      // normal markdown in this segment
      const html = segmentToHtml(seg);
      out.push(html);
    }
  }
  return out.join("");
}

function segmentToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");

  const htmlLines: string[] = [];
  let listBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length) {
      htmlLines.push(`<ul>${listBuffer.join("")}</ul>`);
      listBuffer = [];
    }
  }

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      htmlLines.push("<br/>");
      continue;
    }
    // Headings (check longest first)
    if (/^######\s+/.test(line)) { flushList(); htmlLines.push(`<h6>${inline(line.replace(/^######\s+/, ""))}</h6>`); continue; }
    if (/^#####\s+/.test(line))  { flushList(); htmlLines.push(`<h5>${inline(line.replace(/^#####\s+/, ""))}</h5>`); continue; }
    if (/^####\s+/.test(line))   { flushList(); htmlLines.push(`<h4>${inline(line.replace(/^####\s+/, ""))}</h4>`); continue; }
    if (/^###\s+/.test(line))    { flushList(); htmlLines.push(`<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`); continue; }
    if (/^##\s+/.test(line))     { flushList(); htmlLines.push(`<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`); continue; }
    if (/^#\s+/.test(line))      { flushList(); htmlLines.push(`<h1>${inline(line.replace(/^#\s+/, ""))}</h1>`); continue; }
    // Lists
    if (/^[-*]\s+/.test(line)) {
      listBuffer.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    // Paragraph-ish line
    flushList();
    htmlLines.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return htmlLines.join("");
}

function inline(text: string): string {
  // escape first
  let s = escapeHtml(text);
  // inline code
  s = s.replace(/`([^`]+)`/g, (_m, g1) => `<code>${g1}</code>`);
  // bold **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, (_m, g1) => `<strong>${g1}</strong>`);
  // italics *text*
  s = s.replace(/\*([^*]+)\*/g, (_m, g1) => `<em>${g1}</em>`);
  return s;
}
