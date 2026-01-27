// functions/api/reels.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toStr = (v: any, fallback = '') => {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim() || fallback;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/**
 * POST /api/reels
 * Body:
 *  {
 *    user_id: number,
 *    video_url: string,
 *    caption?: string,
 *    song_name?: string,
 *    audio_url?: string,
 *    audio_start?: number,
 *    audio_end?: number,
 *    visibility?: 'public'|'friends'|'private',
 *    location?: string
 *  }
 *
 * Returns: { success:true, reel_id:number, reel: {...} }
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'DB binding missing (DB)' }, 500);

    const body = await request.json().catch(() => ({} as any));

    const user_id = toInt(body.user_id, 0);
    const video_url = toStr(body.video_url, '');
    const caption = toStr(body.caption, '');
    const song_name = toStr(body.song_name, 'Original Sound');

    const audio_url = toStr(body.audio_url, ''); // optional
    const audio_start = clamp(toInt(body.audio_start, 0), 0, 10_000_000);
    const audio_end = clamp(toInt(body.audio_end, 0), 0, 10_000_000);

    const visibilityRaw = toStr(body.visibility, 'public').toLowerCase();
    const visibility =
      visibilityRaw === 'friends' || visibilityRaw === 'private' ? visibilityRaw : 'public';

    const location = toStr(body.location, '');

    if (!user_id || !video_url) {
      return json({ success: false, error: 'user_id and video_url are required' }, 400);
    }

    // ✅ Works even if some columns don't exist (fallback insert below)
    // We attempt the "full" insert first; if your table doesn't have columns yet,
    // we catch and insert only base columns (user_id, video_url, caption, song_name).
    let reelId = 0;

    try {
      const result = await env.DB.prepare(
        `INSERT INTO reels
          (user_id, video_url, caption, song_name, audio_url, audio_start, audio_end, visibility, location)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          user_id,
          video_url,
          caption || null,
          song_name || null,
          audio_url || null,
          audio_start || 0,
          audio_end || 0,
          visibility,
          location || null
        )
        .run();

      reelId = Number(result.meta.last_row_id || 0);
    } catch (e: any) {
      // fallback: old schema
      const result = await env.DB.prepare(
        `INSERT INTO reels (user_id, video_url, caption, song_name) VALUES (?, ?, ?, ?)`
      )
        .bind(user_id, video_url, caption || null, song_name || null)
        .run();

      reelId = Number(result.meta.last_row_id || 0);
    }

    const created = await env.DB
      .prepare(
        `SELECT id, user_id, video_url, caption, song_name,
                audio_url, audio_start, audio_end, visibility, location,
                shares, views, created_at
         FROM reels
         WHERE id = ?`
      )
      .bind(reelId)
      .first();

    return json(
      {
        success: true,
        reel_id: reelId,
        reel: created || { id: reelId, user_id, video_url, caption, song_name, audio_url, audio_start, audio_end, visibility, location },
      },
      200
    );
  } catch (err: any) {
    return json({ success: false, error: err?.message || 'Failed to create reel' }, 500);
  }
};

/**
 * GET /api/reels?viewerId=123
 * Returns array of reels with:
 *  - reactions: [{user_id, type}]
 *  - comments: [{id, user_id, text, created_at}]
 *  - reactions_count, comments_count, my_reaction
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'DB binding missing (DB)' }, 500);

    const url = new URL(request.url);
    const viewerId = toInt(url.searchParams.get('viewerId'), 0);

    // 1) reels
    const reelsRes = await env.DB
      .prepare(
        `SELECT id, user_id, video_url, caption, song_name,
                audio_url, audio_start, audio_end, visibility, location,
                shares, views, created_at
         FROM reels
         ORDER BY created_at DESC
         LIMIT 200`
      )
      .all();

    const reels = Array.isArray(reelsRes.results) ? reelsRes.results : [];
    const reelIds = reels.map((r: any) => toInt(r.id, 0)).filter(Boolean);

    if (!reelIds.length) return json([], 200);

    const placeholders = reelIds.map(() => '?').join(',');

    // 2) likes/reactions
    // ✅ Supports both schemas:
    // - New: reel_likes(reel_id, user_id, type)
    // - Old: reel_likes(reel_id, user_id)  (no "type")
    let likes: any[] = [];
    try {
      const likesRes = await env.DB
        .prepare(
          `SELECT reel_id, user_id, type
           FROM reel_likes
           WHERE reel_id IN (${placeholders})`
        )
        .bind(...reelIds)
        .all();
      likes = Array.isArray(likesRes.results) ? likesRes.results : [];
    } catch {
      const likesRes = await env.DB
        .prepare(
          `SELECT reel_id, user_id
           FROM reel_likes
           WHERE reel_id IN (${placeholders})`
        )
        .bind(...reelIds)
        .all();
      likes = (Array.isArray(likesRes.results) ? likesRes.results : []).map((x: any) => ({
        ...x,
        type: 'love',
      }));
    }

    // 3) comments (latest first; attach up to 50 per reel)
    const commentsRes = await env.DB
      .prepare(
        `SELECT id, reel_id, user_id, text, created_at
         FROM reel_comments
         WHERE reel_id IN (${placeholders})
         ORDER BY created_at DESC`
      )
      .bind(...reelIds)
      .all();

    const comments = Array.isArray(commentsRes.results) ? commentsRes.results : [];

    // Group them
    const likesByReel = new Map<number, any[]>();
    for (const l of likes) {
      const rid = toInt((l as any).reel_id, 0);
      if (!rid) continue;
      if (!likesByReel.has(rid)) likesByReel.set(rid, []);
      likesByReel.get(rid)!.push({
        user_id: toInt((l as any).user_id, 0),
        type: toStr((l as any).type, 'love') as string,
      });
    }

    const commentsByReel = new Map<number, any[]>();
    for (const c of comments) {
      const rid = toInt((c as any).reel_id, 0);
      if (!rid) continue;
      if (!commentsByReel.has(rid)) commentsByReel.set(rid, []);
      commentsByReel.get(rid)!.push({
        id: toInt((c as any).id, 0),
        user_id: (c as any).user_id == null ? null : toInt((c as any).user_id, 0),
        text: toStr((c as any).text, ''),
        created_at: (c as any).created_at,
      });
    }

    const out = reels.map((r: any) => {
      const rid = toInt(r.id, 0);
      const reactions = likesByReel.get(rid) || [];
      const reelComments = commentsByReel.get(rid) || [];
      const limitedComments = reelComments.slice(0, 50);

      const my_reaction =
        viewerId ? reactions.find((x) => toInt(x.user_id, 0) === viewerId)?.type ?? null : null;

      return {
        ...r,
        // normalize numbers
        id: rid,
        user_id: toInt(r.user_id, 0),
        shares: toInt(r.shares, 0),
        views: toInt(r.views, 0),
        audio_start: toInt((r as any).audio_start, 0),
        audio_end: toInt((r as any).audio_end, 0),

        reactions,
        comments: limitedComments,
        reactions_count: reactions.length,
        comments_count: reelComments.length,
        my_reaction,
      };
    });

    return json(out, 200);
  } catch (err: any) {
    return json({ success: false, error: err?.message || 'Failed to fetch reels' }, 500);
  }
};
