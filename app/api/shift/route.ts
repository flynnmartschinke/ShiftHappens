import { env } from "cloudflare:workers";
import { assignments, completed, revisionStep } from "../../coverage";

export const dynamic = "force-dynamic";

const roomPattern = /^[a-f0-9]{32}$/;
const headers = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers });

async function readStage(db: D1Database, room: string) {
  const record = await db.prepare("SELECT stage FROM demo_shifts WHERE room = ?")
    .bind(room).first<{ stage: number }>();
  return record?.stage ?? 0;
}

export async function GET(request: Request) {
  const { DB } = env;
  if (!DB) return fail("The demo database is unavailable.", 503);

  const room = new URL(request.url).searchParams.get("room") ?? "";
  if (!roomPattern.test(room)) return fail("Use a valid demo link.", 400);

  return Response.json({ stage: await readStage(DB, room) }, { headers });
}

export async function POST(request: Request) {
  const { DB } = env;
  if (!DB) return fail("The demo database is unavailable.", 503);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return fail("The request could not be read.", 400);
  }
  if (!input || typeof input !== "object" || !("room" in input) ||
      typeof input.room !== "string" || !roomPattern.test(input.room) || !("action" in input)) {
    return fail("Use a valid demo link and action.", 400);
  }

  const { room, action } = input;
  if (action === "report") {
    await DB.prepare("INSERT INTO demo_shifts (room, stage) VALUES (?, 1) ON CONFLICT(room) DO NOTHING")
      .bind(room).run();
  } else {
    const legacy = action === "assign-jo" ? "assign-1" : action === "assign-rae" ? "assign-2" : action;
    const match = typeof legacy === "string" && /^(assign|clear)-(1|2|4|8|16)$/.exec(legacy);
    const changed = match && assignments.find(item => item.bit === Number(match[2]));
    if (!match || !changed) return fail("That action is outside the demo.", 400);

    const mask = revisionStep - 1;
    if (match[1] === "assign") {
      const conflicts = assignments.reduce((bits, item) =>
        item.worker === changed.worker || item.role === changed.role ? bits | item.bit : bits, 0);
      await DB.prepare("UPDATE demo_shifts SET stage = stage + ? WHERE room = ? AND stage > 0 AND ((stage - 1) & ?) = 0")
        .bind(revisionStep + changed.bit, room, conflicts).run();
    } else {
      await DB.prepare("UPDATE demo_shifts SET stage = stage + ? WHERE room = ? AND stage > 0 AND ((stage - 1) & ?) != 0 AND ((stage - 1) & ?) != ?")
        .bind(revisionStep - changed.bit, room, changed.bit, mask, completed).run();
    }
  }

  return Response.json({ stage: await readStage(DB, room) }, { headers });
}
