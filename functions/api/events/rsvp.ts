// functions/api/events/rsvp.ts
import type { PagesFunction } from '@cloudflare/workers-types';

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

const safeStr = (v: any) => String(v ?? "").trim();

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));

    const event_id = toInt(body.event_id ?? body.id, 0);
    const user_id = toInt(body.user_id ?? body.viewer_id ?? body.currentUserId, 0);
    const statusRaw = safeStr(body.status).toLowerCase();

    if (!event_id || !user_id) {
      return json({ success: false, error: "Missing event_id or user_id" }, 400);
    }

    // allowed: going | interested | not_going
    const status =
      statusRaw === "going" ? "going" :
      statusRaw === "interested" ? "interested" :
      statusRaw === "not_going" ? "not_going" : "";

    if (!status) {
      return json({ success: false, error: "Invalid status. Use going|interested|not_going" }, 400);
    }

    // ensure event exists
    const ev = await env.DB.prepare(`SELECT id FROM events WHERE id = ?`).bind(event_id).first();
    if (!ev) return json({ success: false, error: "Event not found" }, 404);

    // Always clear existing RSVP (so user can't be in both tables)
    await env.DB.prepare(`DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?`)
      .bind(event_id, user_id)
      .run();

    await env.DB.prepare(`DELETE FROM event_interested WHERE event_id = ? AND user_id = ?`)
      .bind(event_id, user_id)
      .run();

    // Apply new RSVP
    if (status === "going") {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO event_attendees (event_id, user_id) VALUES (?, ?)`
      ).bind(event_id, user_id).run();
    } else if (status === "interested") {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO event_interested (event_id, user_id) VALUES (?, ?)`
      ).bind(event_id, user_id).run();
    }
    // not_going means "removed" (already deleted above)

    // Return counts + my status
    const attendingRow = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM event_attendees WHERE event_id = ?`
    ).bind(event_id).first();
    const interestedRow = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM event_interested WHERE event_id = ?`
    ).bind(event_id).first();

    const attending = toInt((attendingRow as any)?.c, 0);
    const interested = toInt((interestedRow as any)?.c, 0);

    let my_status: "" | "going" | "interested" = "";
    if (status === "going") my_status = "going";
    if (status === "interested") my_status = "interested";
    if (status === "not_going") my_status = "";

    return json({
      success: true,
      event_id,
      user_id,
      my_status,
      attending,
      interested,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
