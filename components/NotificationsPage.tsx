import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: cors });

const safeNumber = (v: any, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const safeText = (v: any, fallback = '') => {
  if (typeof v !== 'string') return fallback;
  return v.trim();
};

/* ==============================
   GET NOTIFICATIONS
   Query params:
   - limit=number
   - offset=number
================================*/
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = safeNumber(request.headers.get('x-user-id'));
    if (!userId) return json({ success: false, error: 'Missing user id' }, 400);

    const url = new URL(request.url);
    const limit = Math.min(Math.max(safeNumber(url.searchParams.get('limit'), 15), 1), 100);
    const offset = Math.max(safeNumber(url.searchParams.get('offset'), 0), 0);

    const { results } = await env.DB.prepare(`
      SELECT
        id,
        recipient_id,
        actor_id,
        type,
        entity_type,
        entity_id,
        parent_id,
        group_key,
        message,
        is_read,
        created_at
      FROM notifications
      WHERE recipient_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ?
      OFFSET ?
    `)
      .bind(userId, limit, offset)
      .all();

    const totalRow = await env.DB.prepare(`
      SELECT COUNT(*) as total
      FROM notifications
      WHERE recipient_id = ?
    `)
      .bind(userId)
      .first<{ total: number | string }>();

    const unreadRow = await env.DB.prepare(`
      SELECT COUNT(*) as unread
      FROM notifications
      WHERE recipient_id = ? AND COALESCE(is_read, 0) = 0
    `)
      .bind(userId)
      .first<{ unread: number | string }>();

    return json({
      success: true,
      data: Array.isArray(results) ? results : [],
      pagination: {
        limit,
        offset,
        total: safeNumber(totalRow?.total, 0),
        has_more: offset + limit < safeNumber(totalRow?.total, 0),
      },
      unread_count: safeNumber(unreadRow?.unread, 0),
    });
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return json({ success: false, error: 'Failed to load notifications' }, 500);
  }
};

/* ==============================
   CREATE NOTIFICATION
   Body:
   {
     recipient_id,
     actor_id,
     type,
     entity_type?,
     entity_id?,
     parent_id?,
     group_key?,
     message?
   }
================================*/
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json<any>().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const recipient_id = safeNumber(body.recipient_id);
    const actor_id = safeNumber(body.actor_id);
    const type = safeText(body.type);
    const entity_type = safeText(body.entity_type) || null;
    const entity_id = body.entity_id != null ? String(body.entity_id).trim() : null;
    const parent_id = body.parent_id != null ? String(body.parent_id).trim() : null;
    const group_key = body.group_key != null ? String(body.group_key).trim() : null;
    const message = safeText(body.message) || null;

    if (!recipient_id || !actor_id || !type) {
      return json(
        { success: false, error: 'recipient_id, actor_id and type are required' },
        400
      );
    }

    if (recipient_id === actor_id) {
      return json({ success: true, skipped: true, reason: 'self_notification_blocked' });
    }

    const result = await env.DB.prepare(`
      INSERT INTO notifications
      (
        recipient_id,
        actor_id,
        type,
        entity_type,
        entity_id,
        parent_id,
        group_key,
        message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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

    return json({
      success: true,
      id: result.meta?.last_row_id ?? null,
    });
  } catch (error) {
    console.error('POST /api/notifications error:', error);
    return json({ success: false, error: 'Failed to create notification' }, 500);
  }
};

/* ==============================
   MARK ALL AS READ
   PATCH /api/notifications
================================*/
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = safeNumber(request.headers.get('x-user-id'));
    if (!userId) return json({ success: false, error: 'Missing user id' }, 400);

    await env.DB.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE recipient_id = ? AND COALESCE(is_read, 0) = 0
    `)
      .bind(userId)
      .run();

    return json({ success: true });
  } catch (error) {
    console.error('PATCH /api/notifications error:', error);
    return json({ success: false, error: 'Failed to mark notifications as read' }, 500);
  }
};

/* ==============================
   DELETE ONE NOTIFICATION
   DELETE /api/notifications?id=123
================================*/
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = safeNumber(request.headers.get('x-user-id'));
    if (!userId) return json({ success: false, error: 'Missing user id' }, 400);

    const url = new URL(request.url);
    const id = safeNumber(url.searchParams.get('id'));
    if (!id) return json({ success: false, error: 'Missing notification id' }, 400);

    const existing = await env.DB.prepare(`
      SELECT id
      FROM notifications
      WHERE id = ? AND recipient_id = ?
      LIMIT 1
    `)
      .bind(id, userId)
      .first();

    if (!existing) {
      return json({ success: false, error: 'Notification not found' }, 404);
    }

    await env.DB.prepare(`
      DELETE FROM notifications
      WHERE id = ? AND recipient_id = ?
    `)
      .bind(id, userId)
      .run();

    return json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('DELETE /api/notifications error:', error);
    return json({ success: false, error: 'Failed to delete notification' }, 500);
  }
};
