// functions/api/feeds.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);

    const userId = toInt(url.searchParams.get('userId'), 0);
    const limit = Math.min(100, Math.max(1, toInt(url.searchParams.get('limit'), 30)));

    if (!userId) return json({ success: false, error: 'Missing userId' }, 400);

    // Mix ratios (simple early-stage)
    const followingLimit = Math.max(5, Math.floor(limit * 0.5)); // 50%
    const suggestedLimit = Math.max(5, Math.floor(limit * 0.3)); // 30%
    const trendingLimit = Math.max(0, limit - followingLimit - suggestedLimit); // remaining

    // Deterministic seed for "random-like" ordering without RANDOM()
    const seed = userId * 7919 + 104729;

    // NOTE: this query avoids full-table follower_counts and avoids ORDER BY RANDOM().
    // It also limits suggestion candidates window for performance.
    const query = `
      WITH
      my_following AS (
        SELECT following_id
        FROM user_follows
        WHERE follower_id = ?
      ),

      -- 1) Following + self posts (recent)
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

          -- follower count via indexed lookup (fast with idx_user_follows_following_id)
          (SELECT COUNT(*) FROM user_follows uf WHERE uf.following_id = u.id) AS follower_count,

          'following' AS pool
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE
          p.user_id = ?
          OR p.user_id IN (SELECT following_id FROM my_following)
        ORDER BY p.created_at DESC
        LIMIT ${followingLimit}
      ),

      -- 2) Suggested: restrict to a candidate window (recent users), then count followers only for those candidates
      suggested_candidates AS (
        SELECT
          u.id,
          u.username,
          u.profile_image_url,
          u.is_verified,
          u.role,
          COALESCE(u.joined_date, u.created_at) AS joined_at
        FROM users u
        WHERE
          u.id != ?
          AND u.id NOT IN (SELECT following_id FROM my_following)
          AND (u.role IS NULL OR u.role != 'admin')
        ORDER BY joined_at DESC
        LIMIT 2000
      ),

      candidate_follower_counts AS (
        SELECT following_id AS user_id, COUNT(*) AS follower_count
        FROM user_follows
        WHERE following_id IN (SELECT id FROM suggested_candidates)
        GROUP BY following_id
      ),

      suggested_authors AS (
        SELECT
          sc.id AS author_id,
          COALESCE(cfc.follower_count, 0) AS follower_count
        FROM suggested_candidates sc
        LEFT JOIN candidate_follower_counts cfc ON cfc.user_id = sc.id
        ORDER BY
          COALESCE(cfc.follower_count, 0) ASC,
          ((sc.id * 1103515245 + ?) % 2147483647) ASC
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

      -- 3) Trending (recent, simple)
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
          (SELECT COUNT(*) FROM user_follows uf WHERE uf.following_id = u.id) AS follower_count,

          'trending' AS pool
        FROM posts p
        JOIN users u ON u.id = p.user_id
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

    // Placeholders order:
    // 1) my_following follower_id = ?
    // 2) following_posts p.user_id = ?
    // 3) suggested_candidates u.id != ?
    // 4) suggested_authors seed = ?
    // 5) final LIMIT ?
    const { results } = await env.DB
      .prepare(query)
      .bind(userId, userId, userId, seed, limit)
      .all();

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
