import { json, bad } from "../lib/responses";
import { rid } from "../lib/ids";

export async function start(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => null) as { idea?: string } | null;
    const idea = body?.idea?.trim();
    if (!idea) {
      return bad(400, "missing idea", rid());
    }
    const designId = rid();
    return json({ ok: true, designId, idea });
  } catch (err: any) {
    return bad(500, err?.message || "internal error", rid());
  }
}

// Simple deterministic checker stub
function runCheck(idea?: string | null, outline?: string | null) {
  const txt = (outline || idea || "").toLowerCase();
  const valid = !!txt && (txt.includes("agent") || txt.includes("automate") || txt.length > 24);
  const what = outline ? "outline" : "idea";
  const explanation = !txt
    ? `No ${what} provided to evaluate.`
    : valid
      ? `The ${what} appears suitable for agent-based design based on keywords/complexity.`
      : `The ${what} may be too vague for agent use; add goals, roles, and flows.`;
  return { valid, explanation };
}

export async function check(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => null) as { idea?: string; outline?: string } | null;
    const idea = body?.idea?.trim() || "";
    const outline = body?.outline?.trim() || "";
    if (!idea && !outline) {
      return bad(400, "missing idea or outline", rid());
    }
    const review = runCheck(idea || null, outline || null);
    return json({ ok: true, ...review });
  } catch (err: any) {
    return bad(500, err?.message || "internal error", rid());
  }
}

export async function outline(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => null) as { idea?: string } | null;
    const idea = body?.idea?.trim();
    if (!idea) {
      return bad(400, "missing idea", rid());
    }
    // Deterministic outline scaffold
    const designId = rid();
    const outlineText = [
      "Agents: Consultant, Checker, Outline, Developer",
      "Flow:",
      "1) Consultant receives request, coordinates",
      "2) Checker validates applicability with explanation",
      "3) Outline drafts design + questions, loops with Checker",
      "4) Consultant reviews, gathers answers, issues 'Go'",
      "5) Developer generates detailed specs per agent",
    ].join("\n");
    const questions = [
      "What business goal should the agents optimize?",
      "What systems/data sources must they integrate?",
      "What constraints or compliance rules apply?",
      "What SLAs or success metrics define done?",
    ];
    const checkerReview = runCheck(idea, outlineText);
    return json({ ok: true, designId, outline: outlineText, questions, checkerReview });
  } catch (err: any) {
    return bad(500, err?.message || "internal error", rid());
  }
}
