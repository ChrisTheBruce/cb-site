// POST /functions/api/notify-download
// Sends an email to SUPPORT_EMAIL via Resend API when a file is downloaded.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.SUPPORT_EMAIL) {
    return new Response("Server misconfigured", { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const email = String(body?.email || "").trim();
  const path = String(body?.path || "").trim();
  const ts = String(body?.ts || new Date().toISOString());
  const ua = String(body?.ua || "");

  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return new Response("Bad email", { status: 400 });
  if (!path.startsWith("/")) return new Response("Bad path", { status: 400 });

  const subject = `Download: ${path}`;
  const text = [
    `A file was downloaded from chris.brighouse.com`,
    `Path: ${path}`,
    `Email: ${email}`,
    `Time: ${ts}`,
    `UA: ${ua}`
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [env.SUPPORT_EMAIL],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    return new Response(`Email send failed: ${msg}`, { status: 502 });
  }
  return new Response(null, { status: 204 });
}
