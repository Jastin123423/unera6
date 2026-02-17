// functions/api/events/rsvp.ts
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
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const safeStr = (v: any) => String(v ?? "").trim().toLowerCase();

type RSVPStatus = "going" | "interested" | "not_going";

const normalizeStatus = (v: any): RSVPStatus => {
  const s = safeStr(v);
  if (s === "going") return "going";
  if (s === "interested") return "interested";
  // allow aliases
  if (s === "none" || s === "notgoing" || s === "not_going" || s === "remove" || s === "cancel")
    return "not_going";
  return "not_going";
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));

    const event_id = toInt(body.event_id ?? body.eventId ?? body.id, 0);
    const user_id = toInt(body.user_id ?? body.userId, 0);
    const status = normalizeStatus(body.status);

    if (!event_id) return json({ success: false, error: "Missing event_id" }, 400);
    if (!user_id) return json({ success: false, error: "Missing user_id" }, 400);

    // Ensure event exists
    const ev = await env.DB.prepare(`SELECT id FROM events WHERE id = ? LIMIT 1`).bind(event_id).first();
    if (!ev) return json({ success: false, error: "Event not found" }, 404);

    // Apply RSVP mutation
    if (status === "going") {
      // add attendee, remove interested
      await env.DB.prepare(
        `INSERT OR IGNORE INTO event_attendees (event_id, user_id) VALUES (?, ?)`
      ).bind(event_id, user_id).run();

      await env.DB.prepare(
        `DELETE FROM event_interested WHERE event_id = ? AND user_id = ?`
      ).bind(event_id, user_id).run();
    } else if (status === "interested") {
      // add interested, remove attendee
      await env.DB.prepare(
        `INSERT OR IGNORE INTO event_interested (event_id, user_id) VALUES (?, ?)`
      ).bind(event_id, user_id).run();

      await env.DB.prepare(
        `DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?`
      ).bind(event_id, user_id).run();
    } else {
      // not_going: remove from both
      await env.DB.prepare(
        `DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?`
      ).bind(event_id, user_id).run();

      await env.DB.prepare(
        `DELETE FROM event_interested WHERE event_id = ? AND user_id = ?`
      ).bind(event_id, user_id).run();
    }

    // Return updated counts + my_status
    const counts = await env.DB.prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM event_attendees WHERE event_id = ?) AS attending,
        (SELECT COUNT(*) FROM event_interested WHERE event_id = ?) AS interested,
        CASE
          WHEN EXISTS (SELECT 1 FROM event_attendees  WHERE event_id = ? AND user_id = ?) THEN 'going'
          WHEN EXISTS (SELECT 1 FROM event_interested WHERE event_id = ? AND user_id = ?) THEN 'interested'
          ELSE ''
        END AS my_status
      `
    )
      .bind(event_id, event_id, event_id, user_id, event_id, user_id)
      .first();

    return json({
      success: true,
      event_id,
      user_id,
      status_applied: status,
      attending: Number((counts as any)?.attending ?? 0),
      interested: Number((counts as any)?.interested ?? 0),
      my_status: String((counts as any)?.my_status ?? ""),
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
