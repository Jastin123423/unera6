import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/**
 * POST /api/reels/:reelId/comments
 * Body: { text, user_id? }
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const reel_id = toNum(params?.reelId, 0);
    const body = await request.json().catch(() => ({} as any));

    const headerUserId = toNum(request.headers.get('x-user-id'), 0);
    const bodyUserId = toNum(body.user_id, 0);
    const user_id = headerUserId || bodyUserId || 0;

    const text = String(body.text ?? '').trim();

    if (!reel_id) {
      return json({ success: false, error: 'Invalid reelId' }, 400);
    }

    if (!user_id) {
      return json({ success: false, error: 'user_id is required' }, 400);
    }

    if (!text) {
      return json({ success: false, error: 'text is required' }, 400);
    }

    // Optional: confirm reel exists
    const reel = await env.DB
      .prepare(`SELECT id FROM reels WHERE id = ? LIMIT 1`)
      .bind(reel_id)
      .first();

    if (!reel) {
      return json({ success: false, error: 'Reel not found' }, 404);
    }

    const ins = await env.DB
      .prepare(
        `INSERT INTO reel_comments (user_id, reel_id, text)
         VALUES (?, ?, ?)`
      )
      .bind(user_id, reel_id, text)
      .run();

    const comment_id = Number(ins.meta.last_row_id || 0);

    const comment = await env.DB
      .prepare(
        `SELECT
           rc.id,
           rc.reel_id,
           rc.user_id,
           rc.text,
           rc.created_at
         FROM reel_comments rc
         WHERE rc.id = ?
         LIMIT 1`
      )
      .bind(comment_id)
      .first();

    const countRow = await env.DB
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM reel_comments
         WHERE reel_id = ?`
      )
      .bind(reel_id)
      .first();

    const comments_count = toNum((countRow as any)?.cnt, 0);

    return json({
      success: true,
      comment: comment ?? { id: comment_id, reel_id, user_id, text },
      comments_count,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};

/**
 * GET /api/reels/:reelId/comments
 */
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const reel_id = toNum(params?.reelId, 0);

    if (!reel_id) {
      return json({ success: false, error: 'Invalid reelId' }, 400);
    }

    const res = await env.DB
      .prepare(
        `SELECT
           id,
           reel_id,
           user_id,
           text,
           created_at
         FROM reel_comments
         WHERE reel_id = ?
         ORDER BY created_at DESC
         LIMIT 200`
      )
      .bind(reel_id)
      .all();

    const comments = Array.isArray(res.results) ? res.results : [];

    const countRow = await env.DB
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM reel_comments
         WHERE reel_id = ?`
      )
      .bind(reel_id)
      .first();

    const comments_count = toNum((countRow as any)?.cnt, comments.length);

    return json({
      success: true,
      comments,
      comments_count,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};
