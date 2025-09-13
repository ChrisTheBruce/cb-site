import { json, bad } from "../lib/responses";
import { rid } from "../lib/ids";
import { chatOnce } from "../lib/llm";
import { renderCheckerInitialPrompt } from "../prompts/checker_initial_check";

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
  const txt = (outline || idea || "").trim();
  const what = outline ? "outline" : "idea";
  if (!txt) return { valid: false, explanation: `No ${what} provided to evaluate.` };
  // Default to yes for now (requested behavior)
  return { valid: true, explanation: `Checker approved the ${what} (default allow).` };
}

export async function check(request: Request, env?: any): Promise<Response> {
  try {
    const body = await request.json().catch(() => null) as { idea?: string; outline?: string } | null;
    const idea = body?.idea?.trim() || "";
    const outline = body?.outline?.trim() || "";
    if (!idea && !outline) {
      return bad(400, "missing idea or outline", rid());
    }
    // Prefer LLM-based check using the consultant idea; fallback to static if unavailable
    const consultantText = idea || outline;
    if (env) {
      try {
        const prompt = renderCheckerInitialPrompt(consultantText);
        const answer = await chatOnce(env, [
          { role: 'system', content: 'You are the Checker agent for an enterprise agentic design system.' },
          { role: 'user', content: prompt },
        ], { model: 'gpt-4o-mini', temperature: 0 });
        // Parse yes/no + summary
        const parsed = parseYesNo(answer);
        return json({ ok: true, valid: parsed.valid, explanation: parsed.explanation || answer });
      } catch (e: any) {
        const review = runCheck(idea || null, outline || null);
        return json({ ok: true, valid: review.valid, explanation: `LLM unavailable, fallback: ${review.explanation}` });
      }
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

function parseYesNo(text: string): { valid: boolean; explanation: string } {
  const raw = (text || "").trim();
  const firstLine = raw.split(/\r?\n/)[0] || raw;
  const norm = firstLine.trim().toLowerCase();
  let valid = true;
  if (/^no\b/.test(norm)) valid = false;
  else if (/^yes\b/.test(norm)) valid = true;
  else if (/\bno\b/.test(norm) && !/\byes\b/.test(norm)) valid = false;
  const explanation = raw.replace(/^\s*(yes|no)[:\-\s]*/i, '').trim();
  return { valid, explanation: explanation || raw };
}
