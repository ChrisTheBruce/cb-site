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
