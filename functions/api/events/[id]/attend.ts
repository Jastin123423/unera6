// functions/api/events/[id]/attend.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const eventId = Number((params as any).id);
    if (!eventId) return json({ success: false, error: "Invalid event id" }, 400);

    const body = await request.json().catch(() => ({}));
    const userId = Number(body.user_id ?? 0);
    if (!userId) return json({ success: false, error: "user_id missing" }, 400);

    // going => insert (idempotent)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO event_attendees (event_id, user_id) VALUES (?, ?)`
    ).bind(eventId, userId).run();

    // if going, remove interested
    await env.DB.prepare(
      `DELETE FROM event_interested WHERE event_id=? AND user_id=?`
    ).bind(eventId, userId).run();

    return json({ success: true });
  } catch (err: any) {
    return json({ success: false, error: err?.message || "Failed to attend" }, 500);
  }
};
