// functions/api/reels.ts
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

const toText = (v: any) => {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/**
 * POST /api/reels
 * Supports: audio_url, audio_start, audio_end, visibility, location
 * Returns: full reel row (so frontend can use it immediately)
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));

    const user_id = toNum(body.user_id, 0);
    const video_url = String(body.video_url ?? '').trim();

    const caption = toText(body.caption);
    const song_name = toText(body.song_name) ?? 'Original Sound';

    const audio_url = toText(body.audio_url);
    const audio_start = toNum(body.audio_start, 0);
    const audio_end = toNum(body.audio_end, 0);

    const visibilityRaw = String(body.visibility ?? 'public').toLowerCase();
    const visibility = (['public', 'friends', 'private'].includes(visibilityRaw)
      ? visibilityRaw
      : 'public') as 'public' | 'friends' | 'private';

    const location = toText(body.location);

    if (!user_id || !video_url) {
      return json({ success: false, error: 'user_id and video_url are required' }, 400);
    }

    // NOTE: This assumes your reels table has these columns:
    // audio_url, audio_start, audio_end, visibility, location, views, shares
    const result = await env.DB.prepare(
      `INSERT INTO reels
        (user_id, video_url, caption, song_name, audio_url, audio_start, audio_end, visibility, location, views, shares)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`
    )
      .bind(
        user_id,
        video_url,
        caption,
        song_name,
        audio_url,
        audio_start,
        audio_end,
        visibility,
        location
      )
      .run();

    const reel_id = Number(result.meta.last_row_id || 0);

    // Return the created row
    const row = await env.DB.prepare(
      `SELECT id, user_id, video_url, caption, song_name, audio_url, audio_start, audio_end,
              visibility, location, views, shares, created_at
       FROM reels
       WHERE id = ?
       LIMIT 1`
    )
      .bind(reel_id)
      .first();

    return json({ success: true, reel: row ?? { reel_id } });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};

/**
 * GET /api/reels?viewerId=123
 * Returns reels with: reactions[] (from reel_likes), comments[] (from reel_comments),
 * plus counts + my_reaction and the new fields (audio/visibility/location/shares/views)
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const viewerId = toNum(url.searchParams.get('viewerId'), 0);

    // 1) reels (include new fields)
    const reelsRes = await env.DB.prepare(
      `SELECT id, user_id, video_url, caption, song_name,
              audio_url, audio_start, audio_end,
              visibility, location, views, shares,
              created_at
       FROM reels
       ORDER BY created_at DESC
       LIMIT 200`
    ).all();

    const reels = Array.isArray(reelsRes.results) ? reelsRes.results : [];
    const reelIds = reels.map((r: any) => toNum(r.id, 0)).filter(Boolean);

    if (!reelIds.length) return json([]);

    const placeholders = reelIds.map(() => '?').join(',');

    // 2) likes / reactions (your table is reel_likes)
    const likesRes = await env.DB.prepare(
      `SELECT reel_id, user_id, type
       FROM reel_likes
       WHERE reel_id IN (${placeholders})`
    )
      .bind(...reelIds)
      .all();

    // 3) comments (you already do lightweight; we’ll cap attached per reel below)
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

    // Group likes by reel
    const likesByReel = new Map<number, any[]>();
    for (const l of likes) {
      const rid = toNum((l as any).reel_id, 0);
      if (!rid) continue;
      if (!likesByReel.has(rid)) likesByReel.set(rid, []);
      likesByReel.get(rid)!.push({
        user_id: toNum((l as any).user_id, 0),
        type: String((l as any).type || 'love'),
      });
    }

    // Group comments by reel
    const commentsByReel = new Map<number, any[]>();
    for (const c of comments) {
      const rid = toNum((c as any).reel_id, 0);
      if (!rid) continue;
      if (!commentsByReel.has(rid)) commentsByReel.set(rid, []);
      commentsByReel.get(rid)!.push({
        id: toNum((c as any).id, 0),
        user_id: (c as any).user_id == null ? null : toNum((c as any).user_id, 0),
        text: String((c as any).text || ''),
        created_at: (c as any).created_at,
      });
    }

    const out = reels.map((r: any) => {
      const rid = toNum(r.id, 0);
      const reactions = likesByReel.get(rid) || [];
      const reelComments = commentsByReel.get(rid) || [];

      // attach limited comments to reduce payload
      const limitedComments = reelComments.slice(0, 50);

      const my_reaction =
        viewerId ? reactions.find((x) => toNum(x.user_id, 0) === viewerId)?.type ?? null : null;

      return {
        ...r,

        // normalize numeric fields
        id: rid,
        user_id: toNum(r.user_id, 0),
        views: toNum(r.views, 0),
        shares: toNum(r.shares, 0),
        audio_start: toNum(r.audio_start, 0),
        audio_end: toNum(r.audio_end, 0),

        reactions,
        comments: limitedComments,

        reactions_count: reactions.length,
        comments_count: reelComments.length,
        my_reaction,
      };
    });

    return json(out);
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};
