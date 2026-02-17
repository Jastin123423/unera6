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

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const safeStr = (v: any) => String(v ?? "").trim();

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));
    const eventId = toInt(body.event_id ?? body.eventId, 0);
    const userId = toInt(body.user_id ?? body.userId, 0);
    const status = safeStr(body.status).toLowerCase(); // going | interested | not_going

    if (!eventId || !userId) {
      return json({ success: false, error: "Missing event_id or user_id" }, 400);
    }

    // Validate event exists
    const ev = await env.DB.prepare(`SELECT id FROM events WHERE id = ? LIMIT 1`).bind(eventId).first();
    if (!ev) return json({ success: false, error: "Event not found" }, 404);

    // Apply RSVP
    if (status === "going") {
      // Going => attendee yes, interested no
      await env.DB.prepare(`DELETE FROM event_interested WHERE event_id = ? AND user_id = ?`)
        .bind(eventId, userId).run();

      await env.DB.prepare(
        `INSERT OR IGNORE INTO event_attendees (event_id, user_id) VALUES (?, ?)`
      ).bind(eventId, userId).run();
    } else if (status === "interested") {
      // Interested => interested yes, attendee no
      await env.DB.prepare(`DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?`)
        .bind(eventId, userId).run();

      await env.DB.prepare(
        `INSERT OR IGNORE INTO event_interested (event_id, user_id) VALUES (?, ?)`
      ).bind(eventId, userId).run();
    } else if (status === "not_going" || status === "none" || status === "") {
      // Clear both
      await env.DB.prepare(`DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?`)
        .bind(eventId, userId).run();

      await env.DB.prepare(`DELETE FROM event_interested WHERE event_id = ? AND user_id = ?`)
        .bind(eventId, userId).run();
    } else {
      return json({ success: false, error: "Invalid status. Use going|interested|not_going" }, 400);
    }

    // Recompute counts + my status
    const attendingRow = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM event_attendees WHERE event_id = ?`
    ).bind(eventId).first();
    const interestedRow = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM event_interested WHERE event_id = ?`
    ).bind(eventId).first();

    const isGoing = await env.DB.prepare(
      `SELECT 1 AS ok FROM event_attendees WHERE event_id = ? AND user_id = ? LIMIT 1`
    ).bind(eventId, userId).first();

    const isInterested = await env.DB.prepare(
      `SELECT 1 AS ok FROM event_interested WHERE event_id = ? AND user_id = ? LIMIT 1`
    ).bind(eventId, userId).first();

    const my_status = isGoing ? "going" : (isInterested ? "interested" : "");

    return json({
      success: true,
      event_id: eventId,
      my_status,
      attending: toInt((attendingRow as any)?.c, 0),
      interested: toInt((interestedRow as any)?.c, 0),
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
