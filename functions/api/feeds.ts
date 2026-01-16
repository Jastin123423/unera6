import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: cors });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestOptions: PagesFunction<Env> = async () => new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'D1 binding missing (DB)' }, 500);

    const url = new URL(request.url);

    const userId = toInt(url.searchParams.get('userId'), 0);
    const limit = Math.min(100, Math.max(1, toInt(url.searchParams.get('limit'), 30)));

    if (!userId) {
      return json(
        {
          success: false,
          error: 'Missing userId',
          debug: { params: Object.fromEntries(url.searchParams.entries()) },
        },
        400
      );
    }

    const followingLimit = Math.max(5, Math.floor(limit * 0.5));
    const suggestedLimit = Math.max(5, Math.floor(limit * 0.3));
    const trendingLimit = Math.max(0, limit - followingLimit - suggestedLimit);

    // ✅ deterministic "shuffle" for suggested authors (fast, no RANDOM())
    // Uses a simple hash-like ordering seeded by userId.
    const query = `
      WITH
      my_following AS (
        SELECT following_id
        FROM user_follows
        WHERE follower_id = ?
      ),

      follower_counts AS (
        SELECT following_id AS user_id, COUNT(*) AS follower_count
        FROM user_follows
        GROUP BY following_id
      ),

      following_posts AS (
        SELECT
          p.id,
          p.user_id,
          p.content,
          p.media_url,
          p.media_type,
          p.created_at,
          COALESCE(p.shares, 0) AS shares,
          COALESCE(p.views, 0) AS views,

          u.username,
          u.profile_image_url,
          u.is_verified,
          u.role,
          COALESCE(fc.follower_count, 0) AS follower_count,

          'following' AS pool
        FROM posts p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN follower_counts fc ON fc.user_id = u.id
        WHERE
          p.user_id = ?
          OR p.user_id IN (SELECT following_id FROM my_following)
        ORDER BY p.created_at DESC
        LIMIT ${followingLimit}
      ),

      suggested_authors AS (
        SELECT
          u.id AS author_id,
          COALESCE(fc.follower_count, 0) AS follower_count
        FROM users u
        LEFT JOIN follower_counts fc ON fc.user_id = u.id
        WHERE
          u.id != ?
          AND u.id NOT IN (SELECT following_id FROM my_following)
          AND (u.role IS NULL OR u.role != 'admin')
        ORDER BY
          COALESCE(fc.follower_count, 0) ASC,
          -- ✅ deterministic shuffle instead of RANDOM()
          ((u.id * 1103515245 + ?) % 2147483647) ASC
        LIMIT ${Math.max(40, suggestedLimit * 6)}
      ),

      suggested_posts AS (
        SELECT
          p.id,
          p.user_id,
          p.content,
          p.media_url,
          p.media_type,
          p.created_at,
          COALESCE(p.shares, 0) AS shares,
          COALESCE(p.views, 0) AS views,

          u.username,
          u.profile_image_url,
          u.is_verified,
          u.role,
          sa.follower_count AS follower_count,

          'suggested' AS pool
        FROM posts p
        JOIN users u ON u.id = p.user_id
        JOIN suggested_authors sa ON sa.author_id = p.user_id
        WHERE p.created_at >= datetime('now', '-14 days')
        ORDER BY p.created_at DESC
        LIMIT ${suggestedLimit}
      ),

      trending_posts AS (
        SELECT
          p.id,
          p.user_id,
          p.content,
          p.media_url,
          p.media_type,
          p.created_at,
          COALESCE(p.shares, 0) AS shares,
          COALESCE(p.views, 0) AS views,

          u.username,
          u.profile_image_url,
          u.is_verified,
          u.role,
          COALESCE(fc.follower_count, 0) AS follower_count,

          'trending' AS pool
        FROM posts p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN follower_counts fc ON fc.user_id = u.id
        WHERE p.created_at >= datetime('now', '-2 days')
        ORDER BY (COALESCE(p.shares, 0) * 3.0 + COALESCE(p.views, 0) * 0.02) DESC,
                 p.created_at DESC
        LIMIT ${trendingLimit}
      )

      SELECT * FROM following_posts
      UNION ALL
      SELECT * FROM suggested_posts
      UNION ALL
      SELECT * FROM trending_posts
      ORDER BY created_at DESC
      LIMIT ?
    `;

    // binds:
    // 1) my_following follower_id
    // 2) following_posts self user_id
    // 3) suggested_authors u.id != userId
    // 4) suggested_authors shuffle seed (userId)
    // 5) final LIMIT
    const { results } = await env.DB.prepare(query).bind(userId, userId, userId, userId, limit).all();

    return json({
      success: true,
      userId,
      limit,
      mix: { following: followingLimit, suggested: suggestedLimit, trending: trendingLimit },
      feed: Array.isArray(results) ? results : [],
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};
