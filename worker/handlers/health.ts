import { json } from "../lib/responses";

export function handleHealth() {
  return json({ ok: true, ts: Date.now() });
}
