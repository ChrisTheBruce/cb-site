// src/services/agentDesign.ts
export type StartDesignResponse = { ok: boolean; designId: string; idea: string };
export type OutlineStartResponse = {
  ok: boolean;
  designId: string;
  outline: string;
  questions: string[];
  checkerReview: { valid: boolean; explanation: string };
};

export async function startDesign(idea: string): Promise<StartDesignResponse> {
  const resp = await fetch("/api/design/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Design start ${resp.status}: ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as StartDesignResponse;
}

export async function startOutlineDesign(idea: string): Promise<OutlineStartResponse> {
  const resp = await fetch("/api/design/outline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Outline ${resp.status}: ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as OutlineStartResponse;
}
