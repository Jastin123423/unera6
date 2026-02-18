import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: any) => String(v ?? "").trim();

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));
    const eventId = toInt(body.event_id, 0);
    const userId = toInt(body.user_id, 0);
    const action = str(body.action || "add").toLowerCase(); // add | remove

    if (!eventId) return json({ success: false, error: "event_id missing" }, 400);
    if (!userId) return json({ success: false, error: "user_id missing" }, 400);

    if (action === "add") {
      // ✅ interested = insert (idempotent)
      await env.DB.prepare(
        `INSERT OR IGNORE INTO event_interested (event_id, user_id) VALUES (?, ?)`
      ).bind(eventId, userId).run();

      // ✅ if interested, remove going
      await env.DB.prepare(
        `DELETE FROM event_attendees WHERE event_id=? AND user_id=?`
      ).bind(eventId, userId).run();
    } else {
      // ✅ remove interested
      await env.DB.prepare(
        `DELETE FROM event_interested WHERE event_id=? AND user_id=?`
      ).bind(eventId, userId).run();
    }

    // Return counts + my status
    const attendingRow = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM event_attendees WHERE event_id=?`
    ).bind(eventId).first();

    const interestedRow = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM event_interested WHERE event_id=?`
    ).bind(eventId).first();

    const isGoing = await env.DB.prepare(
      `SELECT 1 as ok FROM event_attendees WHERE event_id=? AND user_id=? LIMIT 1`
    ).bind(eventId, userId).first();

    const isInterested = await env.DB.prepare(
      `SELECT 1 as ok FROM event_interested WHERE event_id=? AND user_id=? LIMIT 1`
    ).bind(eventId, userId).first();

    const my_status = isGoing ? "going" : (isInterested ? "interested" : "");

    return json({
      success: true,
      event_id: eventId,
      attending_count: Number((attendingRow as any)?.c ?? 0),
      interested_count: Number((interestedRow as any)?.c ?? 0),
      my_status,
    });
  } catch (err: any) {
    return json({ success: false, error: err?.message || "Failed to mark interested" }, 500);
  }
};
