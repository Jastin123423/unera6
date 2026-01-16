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

const toTime = (v: any) => {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
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

    // Split limits to keep each query small/fast
    const selfLimit = Math.max(3, Math.floor(limit * 0.3));       // 30%
    const followingLimit = Math.max(5, limit - selfLimit);        // 70%

    // 1) Self posts (uses idx_posts_user_created_at)
    const selfQ = `
      SELECT
        p.id, p.user_id, p.content, p.media_url, p.media_type, p.visibility, p.created_at,
        p.views, p.shares,
        u.username, u.profile_image_url, u.is_verified, u.role,
        'self' AS pool
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    const selfRes = await env.DB.prepare(selfQ).bind(userId, selfLimit).all();
    const selfPosts = Array.isArray(selfRes.results) ? selfRes.results : [];

    // 2) Following posts (NO UNION, small LIMIT)
    // This uses user_follows index + posts(user_id, created_at) index
    const followingQ = `
      SELECT
        p.id, p.user_id, p.content, p.media_url, p.media_type, p.visibility, p.created_at,
        p.views, p.shares,
        u.username, u.profile_image_url, u.is_verified, u.role,
        'following' AS pool
      FROM user_follows uf
      JOIN posts p ON p.user_id = uf.following_id
      JOIN users u ON u.id = p.user_id
      WHERE uf.follower_id = ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    const followingRes = await env.DB.prepare(followingQ).bind(userId, followingLimit).all();
    const followingPosts = Array.isArray(followingRes.results) ? followingRes.results : [];

    // 3) Merge + dedupe + sort in JS (fast because arrays are small)
    const combined = [...selfPosts, ...followingPosts];

    const seen = new Set<number>();
    const deduped = combined.filter((r: any) => {
      const id = Number(r?.id);
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    deduped.sort((a: any, b: any) => toTime(b.created_at) - toTime(a.created_at));

    return json({
      success: true,
      userId,
      limit,
      feed: deduped.slice(0, limit),
      debug: {
        selfCount: selfPosts.length,
        followingCount: followingPosts.length,
        combined: combined.length,
      },
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
