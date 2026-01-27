// functions/api/reel-comments.ts
import type { PagesFunction } from '@cloudflare/workers-types';
type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/**
 * POST /api/reel-comments
 * Body: { reel_id, user_id?, text }
 * Returns: { success:true, comment: {...}, comments_count }
 *
 * ✅ Matches your new Reels.tsx which expects POST /api/reels/:id/comments
 * If you KEEP this endpoint, call it from frontend.
 * If you use /api/reels/:id/comments, create that route too (recommended).
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));

    const reel_id = toNum(body.reel_id, 0);
    const user_id = body.user_id == null ? null : toNum(body.user_id, 0);
    const text = String(body.text ?? '').trim();

    if (!reel_id || !text) {
      return json({ success: false, error: 'reel_id and text are required' }, 400);
    }

    const ins = await env.DB.prepare(
      `INSERT INTO reel_comments (user_id, reel_id, text) VALUES (?, ?, ?)`
    )
      .bind(user_id, reel_id, text)
      .run();

    const comment_id = Number(ins.meta.last_row_id || 0);

    // Return the created comment row (for instant UI update)
    const comment = await env.DB.prepare(
      `SELECT id, reel_id, user_id, text, created_at
       FROM reel_comments
       WHERE id = ?
       LIMIT 1`
    )
      .bind(comment_id)
      .first();

    // Also return count (optional but very useful for instant count correctness)
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as cnt
       FROM reel_comments
       WHERE reel_id = ?`
    )
      .bind(reel_id)
      .first();

    const comments_count = toNum((countRow as any)?.cnt, 0);

    return json({ success: true, comment: comment ?? { id: comment_id, reel_id, user_id, text }, comments_count });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};

/**
 * GET /api/reel-comments?reel_id=123
 * Returns: { success:true, comments:[...], comments_count }
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const reelId = toNum(url.searchParams.get('reel_id'), 0);

    if (!reelId) return json({ success: false, error: 'reel_id required' }, 400);

    const res = await env.DB.prepare(
      `SELECT id, reel_id, user_id, text, created_at
       FROM reel_comments
       WHERE reel_id = ?
       ORDER BY created_at DESC
       LIMIT 200`
    )
      .bind(reelId)
      .all();

    const comments = Array.isArray(res.results) ? res.results : [];

    // Count for accuracy (optional)
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as cnt
       FROM reel_comments
       WHERE reel_id = ?`
    )
      .bind(reelId)
      .first();

    const comments_count = toNum((countRow as any)?.cnt, comments.length);

    return json({ success: true, comments, comments_count });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};
