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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));
    const eventId = Number(body.event_id ?? 0);
    const userId = Number(body.user_id ?? 0);
    const action = String(body.action ?? "add"); // add | remove

    if (!eventId) return json({ success: false, error: "event_id missing" }, 400);
    if (!userId) return json({ success: false, error: "user_id missing" }, 400);

    if (action === "add") {
      // going => insert (idempotent)
      await env.DB.prepare(
        `INSERT OR IGNORE INTO event_attendees (event_id, user_id) VALUES (?, ?)`
      ).bind(eventId, userId).run();

      // if going, remove interested
      await env.DB.prepare(
        `DELETE FROM event_interested WHERE event_id=? AND user_id=?`
      ).bind(eventId, userId).run();
    } else {
      // remove going
      await env.DB.prepare(
        `DELETE FROM event_attendees WHERE event_id=? AND user_id=?`
      ).bind(eventId, userId).run();
    }

    // return counts + my status (so Feed can update instantly)
    const attending = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM event_attendees WHERE event_id=?`
    ).bind(eventId).first();

    const interested = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM event_interested WHERE event_id=?`
    ).bind(eventId).first();

    const myGoing = await env.DB.prepare(
      `SELECT 1 AS ok FROM event_attendees WHERE event_id=? AND user_id=? LIMIT 1`
    ).bind(eventId, userId).first();

    const myInterested = await env.DB.prepare(
      `SELECT 1 AS ok FROM event_interested WHERE event_id=? AND user_id=? LIMIT 1`
    ).bind(eventId, userId).first();

    const my_status = myGoing ? "going" : myInterested ? "interested" : "";

    return json({
      success: true,
      attending_count: Number((attending as any)?.c ?? 0),
      interested_count: Number((interested as any)?.c ?? 0),
      my_status,
    });
  } catch (err: any) {
    return json({ success: false, error: err?.message || "Failed to attend" }, 500);
  }
};
