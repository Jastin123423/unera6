// functions/api/reels.ts
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
  const { user_id, video_url, caption, song_name } = await request.json().catch(() => ({}));

  if (!user_id || !video_url) {
    return Response.json({ success: false, error: 'user_id and video_url are required' }, { status: 400, headers: cors });
  }

  const result = await env.DB.prepare(
    `INSERT INTO reels (user_id, video_url, caption, song_name) VALUES (?, ?, ?, ?)`
  )
    .bind(Number(user_id), String(video_url), caption ?? null, song_name ?? null)
    .run();

  return Response.json(
    { success: true, reel_id: result.meta.last_row_id },
    { headers: cors }
  );
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const viewerId = Number(url.searchParams.get('viewerId') || 0);

  // 1) reels
  const reelsRes = await env.DB.prepare(
    `SELECT id, user_id, video_url, caption, song_name, created_at
     FROM reels
     ORDER BY created_at DESC
     LIMIT 200`
  ).all();

  const reels = Array.isArray(reelsRes.results) ? reelsRes.results : [];
  const reelIds = reels.map((r: any) => Number(r.id)).filter(Boolean);

  if (!reelIds.length) {
    return Response.json([], { headers: cors });
  }

  const placeholders = reelIds.map(() => '?').join(',');

  // 2) likes
  const likesRes = await env.DB.prepare(
    `SELECT reel_id, user_id, type
     FROM reel_likes
     WHERE reel_id IN (${placeholders})`
  )
    .bind(...reelIds)
    .all();

  // 3) comments (lightweight: latest 30 per reel)
  const commentsRes = await env.DB.prepare(
    `SELECT id, reel_id, user_id, text, created_at
     FROM reel_comments
     WHERE reel_id IN (${placeholders})
     ORDER BY created_at DESC`
  )
    .bind(...reelIds)
    .all();

  const likes = Array.isArray(likesRes.results) ? likesRes.results : [];
  const comments = Array.isArray(commentsRes.results) ? commentsRes.results : [];

  // Group them
  const likesByReel = new Map<number, any[]>();
  for (const l of likes) {
    const rid = Number((l as any).reel_id);
    if (!likesByReel.has(rid)) likesByReel.set(rid, []);
    likesByReel.get(rid)!.push({ user_id: Number((l as any).user_id), type: (l as any).type || 'love' });
  }

  const commentsByReel = new Map<number, any[]>();
  for (const c of comments) {
    const rid = Number((c as any).reel_id);
    if (!commentsByReel.has(rid)) commentsByReel.set(rid, []);
    commentsByReel.get(rid)!.push({
      id: Number((c as any).id),
      user_id: (c as any).user_id == null ? null : Number((c as any).user_id),
      text: String((c as any).text || ''),
      created_at: (c as any).created_at,
    });
  }

  // Attach arrays
  const out = reels.map((r: any) => {
    const rid = Number(r.id);
    const reactions = likesByReel.get(rid) || [];
    const reelComments = commentsByReel.get(rid) || [];

    // If you want: limit comments attached to reduce payload
    const limitedComments = reelComments.slice(0, 50);

    // Optional convenience fields
    const my_reaction =
      viewerId ? reactions.find((x) => Number(x.user_id) === viewerId)?.type ?? null : null;

    return {
      ...r,
      reactions,
      comments: limitedComments,
      reactions_count: reactions.length,
      comments_count: reelComments.length,
      my_reaction,
    };
  });

  return Response.json(out, { headers: cors });
};
