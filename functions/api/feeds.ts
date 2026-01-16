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

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'D1 binding missing (DB).' }, 500);

    const url = new URL(request.url);
    const userId = toInt(url.searchParams.get('userId'), 0);
    const limit = Math.min(100, Math.max(1, toInt(url.searchParams.get('limit'), 30)));

    if (!userId) return json({ success: false, error: 'Missing userId' }, 400);

    // Mix
    const followingLimit = Math.max(5, Math.floor(limit * 0.5)); // 50%
    const suggestedLimit = Math.max(5, Math.floor(limit * 0.3)); // 30%
    const trendingLimit = Math.max(0, limit - followingLimit - suggestedLimit); // remaining

    // 1) Get following list (fast with idx_user_follows_follower_id)
    const followingRows = await env.DB
      .prepare(`SELECT following_id FROM user_follows WHERE follower_id = ?`)
      .bind(userId)
      .all();

    const followingIds = Array.isArray(followingRows.results)
      ? followingRows.results.map((r: any) => Number(r.following_id)).filter(Boolean)
      : [];

    // Build placeholders for IN (...)
    const inList = [userId, ...followingIds]; // include self
    const inPlaceholders = inList.map(() => '?').join(',');

    // 2) Following + self posts (fast with idx_posts_user_created_at)
    const followingPosts = await env.DB
      .prepare(
        `
        SELECT
          p.id, p.user_id, p.content, p.media_url, p.media_type, p.created_at,
          COALESCE(p.shares,0) AS shares,
          COALESCE(p.views,0) AS views,

          u.username, u.profile_image_url, u.is_verified, u.role,
          (SELECT COUNT(*) FROM user_follows uf WHERE uf.following_id = u.id) AS follower_count,
          'following' AS pool
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id IN (${inPlaceholders})
        ORDER BY p.created_at DESC
        LIMIT ?
        `
      )
      .bind(...inList, followingLimit)
      .all();

    // 3) Suggested authors: small creators not followed (no RANDOM, deterministic order)
    // Seed ensures user sees stable suggestions.
    const seed = userId * 7919 + 104729;

    const suggestedAuthors = await env.DB
      .prepare(
        `
        SELECT
          u.id AS author_id,
          u.username,
          u.profile_image_url,
          u.is_verified,
          u.role,
          (SELECT COUNT(*) FROM user_follows uf WHERE uf.following_id = u.id) AS follower_count
        FROM users u
        WHERE u.id != ?
          AND u.id NOT IN (${inPlaceholders})
          AND (u.role IS NULL OR u.role != 'admin')
        ORDER BY
          follower_count ASC,
          COALESCE(u.joined_date, u.created_at) DESC,
          ((u.id * 1103515245 + ?) % 2147483647) ASC
        LIMIT ?
        `
      )
      .bind(userId, ...inList, seed, Math.max(40, suggestedLimit * 6))
      .all();

    const suggestedAuthorIds = Array.isArray(suggestedAuthors.results)
      ? suggestedAuthors.results.map((r: any) => Number(r.author_id)).filter(Boolean)
      : [];

    let suggestedPosts: any[] = [];
    if (suggestedAuthorIds.length) {
      const spPlaceholders = suggestedAuthorIds.map(() => '?').join(',');
      const suggested = await env.DB
        .prepare(
          `
          SELECT
            p.id, p.user_id, p.content, p.media_url, p.media_type, p.created_at,
            COALESCE(p.shares,0) AS shares,
            COALESCE(p.views,0) AS views,

            u.username, u.profile_image_url, u.is_verified, u.role,
            (SELECT COUNT(*) FROM user_follows uf WHERE uf.following_id = u.id) AS follower_count,
            'suggested' AS pool
          FROM posts p
          JOIN users u ON u.id = p.user_id
          WHERE p.user_id IN (${spPlaceholders})
            AND p.created_at >= datetime('now','-14 days')
          ORDER BY p.created_at DESC
          LIMIT ?
          `
        )
        .bind(...suggestedAuthorIds, suggestedLimit)
        .all();

      suggestedPosts = Array.isArray(suggested.results) ? suggested.results : [];
    }

    // 4) Trending (simple)
    let trendingPosts: any[] = [];
    if (trendingLimit > 0) {
      const trending = await env.DB
        .prepare(
          `
          SELECT
            p.id, p.user_id, p.content, p.media_url, p.media_type, p.created_at,
            COALESCE(p.shares,0) AS shares,
            COALESCE(p.views,0) AS views,

            u.username, u.profile_image_url, u.is_verified, u.role,
            (SELECT COUNT(*) FROM user_follows uf WHERE uf.following_id = u.id) AS follower_count,
            'trending' AS pool
          FROM posts p
          JOIN users u ON u.id = p.user_id
          WHERE p.created_at >= datetime('now','-2 days')
          ORDER BY (COALESCE(p.shares,0) * 3.0 + COALESCE(p.views,0) * 0.02) DESC,
                   p.created_at DESC
          LIMIT ?
          `
        )
        .bind(trendingLimit)
        .all();

      trendingPosts = Array.isArray(trending.results) ? trending.results : [];
    }

    // 5) Combine + de-dup by post id + final sort by created_at desc
    const combined = [
      ...(Array.isArray(followingPosts.results) ? followingPosts.results : []),
      ...suggestedPosts,
      ...trendingPosts,
    ];

    const seen = new Set<number>();
    const deduped = combined.filter((r: any) => {
      const id = Number(r?.id);
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    deduped.sort((a: any, b: any) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });

    return json({
      success: true,
      userId,
      limit,
      mix: { following: followingLimit, suggested: suggestedLimit, trending: trendingLimit },
      feed: deduped.slice(0, limit),
    });
  } catch (e: any) {
    // ✅ IMPORTANT: return the real error so you can see it in browser
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
