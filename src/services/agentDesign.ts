// src/services/agentDesign.ts
export type StartDesignResponse = { ok: boolean; designId: string; idea: string };
export type OutlineStartResponse = {
  ok: boolean;
  designId: string;
  outline: string;
  questions: string[];
  checkerReview: { valid: boolean; explanation: string };
  checkerInitialExplanation?: string;
};

export type CheckResponse = {
  ok: boolean;
  valid: boolean;
  explanation: string;
};

export type OutlineUpdateRequest = {
  designId: string;
  idea?: string;
  outline: string;
  answers: string;
  questions?: string[];
  checkerExplanation?: string;
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

export async function startOutlineDesign(idea: string, checkerExplanation?: string): Promise<OutlineStartResponse> {
  const resp = await fetch("/api/design/outline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, checkerExplanation }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Outline ${resp.status}: ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as OutlineStartResponse;
}

export async function checkDesign(payload: { idea?: string; outline?: string }): Promise<CheckResponse> {
  const resp = await fetch("/api/design/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Check ${resp.status}: ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as CheckResponse;
}

export async function updateOutlineDesign(payload: OutlineUpdateRequest): Promise<OutlineStartResponse> {
  const resp = await fetch("/api/design/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Update ${resp.status}: ${text.slice(0, 200)}`);
  }
  return (await resp.json()) as OutlineStartResponse;
}
