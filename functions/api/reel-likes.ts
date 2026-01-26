// functions/api/reel-likes.ts
import type { PagesFunction } from '@cloudflare/workers-types';
type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json().catch(() => ({}));
  const reel_id = Number(body.reel_id || 0);
  const user_id = Number(body.user_id || 0);
  const type = String(body.type || 'love');

  if (!reel_id || !user_id) {
    return Response.json({ success: false, error: 'reel_id and user_id are required' }, { status: 400, headers: cors });
  }

  // check if already liked
  const existing = await env.DB.prepare(
    `SELECT id FROM reel_likes WHERE reel_id = ? AND user_id = ?`
  ).bind(reel_id, user_id).first();

  let liked = false;

  if (existing?.id) {
    // unlike
    await env.DB.prepare(
      `DELETE FROM reel_likes WHERE reel_id = ? AND user_id = ?`
    ).bind(reel_id, user_id).run();
    liked = false;
  } else {
    // like
    await env.DB.prepare(
      `INSERT INTO reel_likes (reel_id, user_id, type) VALUES (?, ?, ?)`
    ).bind(reel_id, user_id, type).run();
    liked = true;
  }

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM reel_likes WHERE reel_id = ?`
  ).bind(reel_id).first();

  const likes_count = Number((countRow as any)?.c || 0);

  return Response.json({ success: true, liked, likes_count }, { headers: cors });
};
