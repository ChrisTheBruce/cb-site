import type { Env } from "../env";

const DEFAULT_FROM = "no-reply@chrisbrighouse.com";       // safe default
const DEFAULT_SUPPORT = "support@chrisbrighouse.com";

export async function sendSupportEmail(env: Env, subject: string, textBody: string) {
  const from = env.FROM_ADDRESS || DEFAULT_FROM;
  const to = env.SUPPORT_EMAIL || DEFAULT_SUPPORT;

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: "Website Download Notifier" },
    subject,
    content: [{ type: "text/plain", value: textBody }],
  };

  const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "MailChannels error");
    throw new Error(err);
  }
}
