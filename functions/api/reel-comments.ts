// functions/api/reel-comments.ts
import type { PagesFunction } from '@cloudflare/workers-types';
type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { user_id, reel_id, text } = await request.json().catch(() => ({}));

  if (!reel_id || !String(text || '').trim()) {
    return Response.json({ success: false, error: 'reel_id and text are required' }, { status: 400, headers: cors });
  }

  await env.DB.prepare(
    `INSERT INTO reel_comments (user_id, reel_id, text) VALUES (?, ?, ?)`
  )
    .bind(user_id == null ? null : Number(user_id), Number(reel_id), String(text).trim())
    .run();

  return Response.json({ success: true }, { headers: cors });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const reelId = Number(url.searchParams.get('reel_id') || 0);
  if (!reelId) return Response.json({ success: false, error: 'reel_id required' }, { status: 400, headers: cors });

  const { results } = await env.DB.prepare(
    `SELECT id, reel_id, user_id, text, created_at
     FROM reel_comments
     WHERE reel_id = ?
     ORDER BY created_at DESC
     LIMIT 200`
  )
    .bind(reelId)
    .all();

  return Response.json({ success: true, comments: results || [] }, { headers: cors });
};
