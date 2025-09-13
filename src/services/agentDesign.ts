// src/services/agentDesign.ts
export type OutlineStartResponse = { ok: boolean; designId: string; idea: string };

export async function requestOutline(idea: string): Promise<OutlineStartResponse> {
  const resp = await fetch("/api/design/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Design start ${resp.status}: ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as OutlineStartResponse;
}
