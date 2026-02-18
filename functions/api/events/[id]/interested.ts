// functions/api/events/[id]/interested.ts
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

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const eventId = Number((params as any).id);
    if (!eventId) return json({ success: false, error: "Invalid event id" }, 400);

    const body = await request.json().catch(() => ({} as any));
    const userId = Number(body.user_id ?? 0);
    if (!userId) return json({ success: false, error: "user_id missing" }, 400);

    const action = String(body.action ?? "interested"); // "interested" | "remove"

    if (action === "remove") {
      await env.DB.prepare(
        `DELETE FROM event_interested WHERE event_id=? AND user_id=?`
      ).bind(eventId, userId).run();
    } else {
      // interested => insert (idempotent)
      await env.DB.prepare(
        `INSERT OR IGNORE INTO event_interested (event_id, user_id) VALUES (?, ?)`
      ).bind(eventId, userId).run();

      // if interested, remove going
      await env.DB.prepare(
        `DELETE FROM event_attendees WHERE event_id=? AND user_id=?`
      ).bind(eventId, userId).run();
    }

    // ✅ counts
    const attending = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM event_attendees WHERE event_id=?`
    ).bind(eventId).first<any>();

    const interested = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM event_interested WHERE event_id=?`
    ).bind(eventId).first<any>();

    // ✅ my status
    const amGoing = await env.DB.prepare(
      `SELECT 1 as ok FROM event_attendees WHERE event_id=? AND user_id=? LIMIT 1`
    ).bind(eventId, userId).first<any>();

    const amInterested = await env.DB.prepare(
      `SELECT 1 as ok FROM event_interested WHERE event_id=? AND user_id=? LIMIT 1`
    ).bind(eventId, userId).first<any>();

    const my_rsvp_status = amGoing ? "going" : (amInterested ? "interested" : "");

    return json({
      success: true,
      event_id: eventId,
      my_rsvp_status,
      attending_count: Number(attending?.c ?? 0),
      interested_count: Number(interested?.c ?? 0),
    });
  } catch (err: any) {
    return json({ success: false, error: err?.message || "Failed to mark interested" }, 500);
  }
};
