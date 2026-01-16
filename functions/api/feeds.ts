// functions/api/feeds.ts
import type { PagesFunction } from '@cloudflare/workers-types';
type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
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

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'DB binding missing (DB)' }, 500);

    const url = new URL(request.url);
    const userId = toInt(url.searchParams.get('userId'), 0);
    const limit = Math.min(50, Math.max(1, toInt(url.searchParams.get('limit'), 20)));

    if (!userId) return json({ success: false, error: 'Missing userId' }, 400);

    // ✅ Get following ids (fast with index on follower_id)
    const f = await env.DB
      .prepare('SELECT following_id FROM user_follows WHERE follower_id = ? LIMIT 2000')
      .bind(userId)
      .all();

    const followingIds = Array.isArray(f.results)
      ? f.results.map((r: any) => Number(r.following_id)).filter(Boolean)
      : [];

    // Always include self
    const ids = [userId, ...followingIds].slice(0, 2000);
    const placeholders = ids.map(() => '?').join(',');

    // ✅ Simple feed: only following + self newest posts
    const feed = await env.DB
      .prepare(
        `
        SELECT
          p.id, p.user_id, p.content, p.media_url, p.media_type, p.created_at,
          COALESCE(p.shares,0) AS shares,
          COALESCE(p.views,0) AS views,

          u.username, u.profile_image_url, u.is_verified, u.role,

          0 AS follower_count,
          'following' AS pool
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id IN (${placeholders})
        ORDER BY p.created_at DESC
        LIMIT ?
        `
      )
      .bind(...ids, limit)
      .all();

    return json({
      success: true,
      userId,
      limit,
      feed: Array.isArray(feed.results) ? feed.results : [],
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
