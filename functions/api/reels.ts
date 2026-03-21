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

const toText = (v: any) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const safeBool = (v: any) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
  }
  return false;
};

const pickFirst = (...values: any[]) => {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/**
 * POST /api/reels
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));

    const headerUserId = toNum(request.headers.get('x-user-id'), 0);
    const bodyUserId = toNum(body.user_id, 0);
    const user_id = headerUserId || bodyUserId || 0;

    // New professional 2-video system
    const video_feed_url =
      toText(body.video_feed_url) ||
      toText(body.video_url_low);

    const video_play_url =
      toText(body.video_play_url) ||
      toText(body.video_url_medium) ||
      toText(body.video_url_hd) ||
      toText(body.video_url);

    // Keep legacy video_url populated for old frontend compatibility
    const video_url =
      video_play_url ||
      video_feed_url ||
      '';

    const thumbnail_url = toText(body.thumbnail_url);
    const caption = toText(body.caption);
    const song_name = toText(body.song_name) ?? 'Original Sound';

    const audio_url = toText(body.audio_url);
    const audio_start = toNum(body.audio_start, 0);
    const audio_end = toNum(body.audio_end, 0);

    const song_id = body.song_id == null ? null : (toNum(body.song_id, 0) || null);
    const sound_id = body.sound_id == null ? null : (toNum(body.sound_id, 0) || null);
    const sound_key = toText(body.sound_key) ?? 'original:none';

    const visibilityRaw = String(body.visibility ?? 'public').trim().toLowerCase();
    const visibility = (
      ['public', 'followers', 'private'].includes(visibilityRaw)
        ? visibilityRaw
        : 'public'
    ) as 'public' | 'followers' | 'private';

    const location = toText(body.location);

    if (!user_id || !video_url) {
      return json({ success: false, error: 'user_id and at least one video URL are required' }, 400);
    }

    const user = await env.DB
      .prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`)
      .bind(user_id)
      .first();

    if (!user) {
      return json({ success: false, error: 'User not found' }, 404);
    }

    const result = await env.DB.prepare(
      `
      INSERT INTO reels (
        user_id,
        video_url,
        video_feed_url,
        video_play_url,
        thumbnail_url,
        caption,
        song_name,
        audio_url,
        audio_start,
        audio_end,
        visibility,
        location,
        views,
        song_id,
        sound_key,
        sound_id,
        shares
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0)
      `
    )
      .bind(
        user_id,
        video_url,
        video_feed_url,
        video_play_url,
        thumbnail_url,
        caption,
        song_name,
        audio_url,
        audio_start,
        audio_end,
        visibility,
        location,
        song_id,
        sound_key,
        sound_id
      )
      .run();

    const reel_id = Number(result.meta?.last_row_id || 0);

    const row = await env.DB.prepare(
      `
      SELECT
        r.id,
        r.user_id,
        r.video_url,
        r.video_feed_url,
        r.video_play_url,
        r.thumbnail_url,
        r.caption,
        r.song_name,
        r.audio_url,
        r.audio_start,
        r.audio_end,
        r.visibility,
        r.location,
        r.views,
        r.shares,
        r.song_id,
        r.sound_id,
        r.sound_key,
        r.created_at,
        u.name,
        u.username,
        u.profile_image_url,
        u.is_verified
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = ?
      LIMIT 1
      `
    )
      .bind(reel_id)
      .first();

    if (!row) {
      return json({ success: true, reel: { id: reel_id } });
    }

    const reel = {
      id: toNum((row as any).id, 0),
      user_id: toNum((row as any).user_id, 0),

      // legacy + new professional fields
      video_url: String((row as any).video_url || ''),
      video_feed_url: pickFirst((row as any).video_feed_url),
      video_play_url: pickFirst((row as any).video_play_url, (row as any).video_url),

      // backward compatibility aliases
      video_url_low: pickFirst((row as any).video_feed_url),
      video_url_medium: pickFirst((row as any).video_play_url, (row as any).video_url),
      video_url_hd: '',

      thumbnail_url: pickFirst((row as any).thumbnail_url),
      caption: pickFirst((row as any).caption),
      song_name: pickFirst((row as any).song_name, 'Original Sound'),
      audio_url: pickFirst((row as any).audio_url),
      audio_start: toNum((row as any).audio_start, 0),
      audio_end: toNum((row as any).audio_end, 0),
      visibility: String((row as any).visibility || 'public'),
      location: pickFirst((row as any).location),
      views: toNum((row as any).views, 0),
      shares: toNum((row as any).shares, 0),
      song_id: (row as any).song_id == null ? null : toNum((row as any).song_id, 0),
      sound_id: (row as any).sound_id == null ? null : toNum((row as any).sound_id, 0),
      sound_key: pickFirst((row as any).sound_key),
      created_at: (row as any).created_at,

      author_name: pickFirst((row as any).name, (row as any).username, 'User'),
      username: pickFirst((row as any).username),
      avatar_url: pickFirst((row as any).profile_image_url),
      verified: safeBool((row as any).is_verified),

      reactions: [],
      comments: [],
      reactions_count: 0,
      comments_count: 0,
      my_reaction: null,
    };

    return json({ success: true, reel });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};

/**
 * GET /api/reels?viewerId=123
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const viewerId = toNum(url.searchParams.get('viewerId'), 0);

    const reelsRes = await env.DB.prepare(
      `
      SELECT
        r.id,
        r.user_id,
        r.video_url,
        r.video_feed_url,
        r.video_play_url,
        r.thumbnail_url,
        r.caption,
        r.song_name,
        r.audio_url,
        r.audio_start,
        r.audio_end,
        r.song_id,
        r.sound_id,
        r.sound_key,
        r.visibility,
        r.location,
        r.views,
        r.shares,
        r.created_at,
        u.name,
        u.username,
        u.profile_image_url,
        u.is_verified
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 200
      `
    ).all();

    const reels = Array.isArray(reelsRes.results) ? reelsRes.results : [];
    const reelIds = reels.map((r: any) => toNum(r.id, 0)).filter(Boolean);

    if (!reelIds.length) {
      return json([]);
    }

    const placeholders = reelIds.map(() => '?').join(',');

    const reactionsRes = await env.DB.prepare(
      `
      SELECT reel_id, user_id, type
      FROM reel_reactions
      WHERE reel_id IN (${placeholders})
      `
    )
      .bind(...reelIds)
      .all();

    const commentsRes = await env.DB.prepare(
      `
      SELECT
        id,
        reel_id,
        user_id,
        parent_comment_id,
        text,
        image_url,
        created_at
      FROM reel_comments
      WHERE reel_id IN (${placeholders})
      ORDER BY created_at DESC, id DESC
      `
    )
      .bind(...reelIds)
      .all();

    const sharesRes = await env.DB.prepare(
      `
      SELECT reel_id, COUNT(*) AS shares_count
      FROM reel_shares
      WHERE reel_id IN (${placeholders})
      GROUP BY reel_id
      `
    )
      .bind(...reelIds)
      .all();

    const reactions = Array.isArray(reactionsRes.results) ? reactionsRes.results : [];
    const comments = Array.isArray(commentsRes.results) ? commentsRes.results : [];
    const sharesRows = Array.isArray(sharesRes.results) ? sharesRes.results : [];

    const reactionsByReel = new Map<number, any[]>();
    for (const r of reactions) {
      const rid = toNum((r as any).reel_id, 0);
      if (!rid) continue;

      if (!reactionsByReel.has(rid)) reactionsByReel.set(rid, []);
      reactionsByReel.get(rid)!.push({
        user_id: toNum((r as any).user_id, 0),
        type: String((r as any).type || 'love'),
      });
    }

    const commentsByReel = new Map<number, any[]>();
    for (const c of comments) {
      const rid = toNum((c as any).reel_id, 0);
      if (!rid) continue;

      if (!commentsByReel.has(rid)) commentsByReel.set(rid, []);
      commentsByReel.get(rid)!.push({
        id: toNum((c as any).id, 0),
        reel_id: rid,
        user_id: toNum((c as any).user_id, 0),
        parent_comment_id:
          (c as any).parent_comment_id == null
            ? null
            : toNum((c as any).parent_comment_id, 0),
        text: String((c as any).text || ''),
        image_url: pickFirst((c as any).image_url),
        created_at: (c as any).created_at,
      });
    }

    const sharesCountByReel = new Map<number, number>();
    for (const s of sharesRows) {
      const rid = toNum((s as any).reel_id, 0);
      if (!rid) continue;
      sharesCountByReel.set(rid, toNum((s as any).shares_count, 0));
    }

    const out = reels.map((r: any) => {
      const rid = toNum(r.id, 0);
      const reelReactions = reactionsByReel.get(rid) || [];
      const reelComments = commentsByReel.get(rid) || [];
      const limitedComments = reelComments.slice(0, 50);
      const shares_count = sharesCountByReel.get(rid) ?? toNum(r.shares, 0);

      const my_reaction = viewerId
        ? reelReactions.find((x) => toNum(x.user_id, 0) === viewerId)?.type ?? null
        : null;

      return {
        id: rid,
        user_id: toNum(r.user_id, 0),

        // legacy + new professional fields
        video_url: String(r.video_url || ''),
        video_feed_url: pickFirst(r.video_feed_url),
        video_play_url: pickFirst(r.video_play_url, r.video_url),

        // backward compatibility aliases
        video_url_low: pickFirst(r.video_feed_url),
        video_url_medium: pickFirst(r.video_play_url, r.video_url),
        video_url_hd: '',

        thumbnail_url: pickFirst(r.thumbnail_url),
        caption: pickFirst(r.caption),
        song_name: pickFirst(r.song_name, 'Original Sound'),
        audio_url: pickFirst(r.audio_url),
        audio_start: toNum(r.audio_start, 0),
        audio_end: toNum(r.audio_end, 0),
        song_id: r.song_id == null ? null : toNum(r.song_id, 0),
        sound_id: r.sound_id == null ? null : toNum(r.sound_id, 0),
        sound_key: pickFirst(r.sound_key),
        visibility: String(r.visibility || 'public'),
        location: pickFirst(r.location),
        views: toNum(r.views, 0),
        shares: shares_count,
        created_at: r.created_at,

        author_name: pickFirst(r.name, r.username, 'User'),
        username: pickFirst(r.username),
        avatar_url: pickFirst(r.profile_image_url),
        verified: safeBool(r.is_verified),

        reactions: reelReactions,
        comments: limitedComments,
        reactions_count: reelReactions.length,
        comments_count: reelComments.length,
        my_reaction,
      };
    });

    return json(out);
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};
