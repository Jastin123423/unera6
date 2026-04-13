import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const safeNumber = (value: any, fallback = 0) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const safeText = (value: any, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

/* ==============================
   GET NOTIFICATIONS
   /api/notifications?limit=15&offset=0
================================*/
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = safeNumber(request.headers.get("x-user-id"));
    if (!userId) return json({ error: "Missing user id" }, 400);

    const url = new URL(request.url);
    const limit = Math.min(Math.max(safeNumber(url.searchParams.get("limit"), 50), 1), 100);
    const offset = Math.max(safeNumber(url.searchParams.get("offset"), 0), 0);

    const { results } = await env.DB.prepare(`
      SELECT *
      FROM notifications
      WHERE recipient_id = ?
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
      LIMIT ?
      OFFSET ?
    `)
      .bind(userId, limit, offset)
      .all();

    const totalRow = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM notifications
      WHERE recipient_id = ?
    `)
      .bind(userId)
      .first<{ total: number | string }>();

    const unreadRow = await env.DB.prepare(`
      SELECT COUNT(*) AS unread
      FROM notifications
      WHERE recipient_id = ?
        AND (is_read = 0 OR is_read IS NULL)
    `)
      .bind(userId)
      .first<{ unread: number | string }>();

    const total = safeNumber(totalRow?.total, 0);
    const unread = safeNumber(unreadRow?.unread, 0);

    return json({
      success: true,
      notifications: results || [],
      unread_count: unread,
      pagination: {
        limit,
        offset,
        total,
        has_more: offset + limit < total,
      },
    });
  } catch (err) {
    console.error("GET notifications failed:", err);
    return json({ error: "Failed to fetch notifications" }, 500);
  }
};

/* ==============================
   CREATE NOTIFICATION
================================*/
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json();

    const recipient_id = safeNumber(body?.recipient_id);
    const actor_id = safeNumber(body?.actor_id);
    const type = safeText(body?.type);
    const entity_type = safeText(body?.entity_type) || null;
    const entity_id = body?.entity_id != null ? String(body.entity_id) : null;
    const parent_id = body?.parent_id != null ? String(body.parent_id) : null;
    const group_key = safeText(body?.group_key) || null;
    const message = safeText(body?.message) || null;

    if (!recipient_id || !actor_id || !type) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Avoid notifying yourself
    if (recipient_id === actor_id) {
      return json({ success: true, skipped: true });
    }

    await env.DB.prepare(`
      INSERT INTO notifications
      (
        recipient_id,
        actor_id,
        type,
        entity_type,
        entity_id,
        parent_id,
        group_key,
        message,
        is_read,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `)
      .bind(
        recipient_id,
        actor_id,
        type,
        entity_type,
        entity_id,
        parent_id,
        group_key,
        message
      )
      .run();

    return json({ success: true });
  } catch (err) {
    console.error("CREATE notification failed:", err);
    return json({ error: "Failed to create notification" }, 500);
  }
};

/* ==============================
   MARK ALL AS READ
   PATCH /api/notifications
================================*/
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = safeNumber(request.headers.get("x-user-id"));
    if (!userId) return json({ error: "Missing user id" }, 400);

    await env.DB.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE recipient_id = ?
        AND (is_read = 0 OR is_read IS NULL)
    `)
      .bind(userId)
      .run();

    return json({ success: true });
  } catch (err) {
    console.error("PATCH notifications failed:", err);
    return json({ error: "Failed to mark notifications as read" }, 500);
  }
};

/* ==============================
   DELETE NOTIFICATION
   DELETE /api/notifications?id=123
================================*/
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = safeNumber(request.headers.get("x-user-id"));
    if (!userId) return json({ error: "Missing user id" }, 400);

    const url = new URL(request.url);
    const notificationId = safeNumber(url.searchParams.get("id"));

    if (!notificationId) {
      return json({ error: "Missing notification id" }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT id
      FROM notifications
      WHERE id = ?
        AND recipient_id = ?
      LIMIT 1
    `)
      .bind(notificationId, userId)
      .first();

    if (!existing) {
      return json({ error: "Notification not found" }, 404);
    }

    await env.DB.prepare(`
      DELETE FROM notifications
      WHERE id = ?
        AND recipient_id = ?
    `)
      .bind(notificationId, userId)
      .run();

    return json({ success: true, id: notificationId });
  } catch (err) {
    console.error("DELETE notification failed:", err);
    return json({ error: "Failed to delete notification" }, 500);
  }
};
