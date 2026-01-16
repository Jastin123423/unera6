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

    // ✅ Wrap UNION in a subquery so ORDER BY works in D1/SQLite
    const q = `
      SELECT *
      FROM (
        SELECT
          p.id AS id,
          p.user_id AS user_id,
          p.content AS content,
          p.media_url AS media_url,
          p.media_type AS media_type,
          p.visibility AS visibility,
          p.created_at AS created_at,
          p.views AS views,
          p.shares AS shares,

          u.username AS username,
          u.profile_image_url AS profile_image_url,
          u.is_verified AS is_verified,
          u.role AS role,

          'self' AS pool
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ?

        UNION ALL

        SELECT
          p.id AS id,
          p.user_id AS user_id,
          p.content AS content,
          p.media_url AS media_url,
          p.media_type AS media_type,
          p.visibility AS visibility,
          p.created_at AS created_at,
          p.views AS views,
          p.shares AS shares,

          u.username AS username,
          u.profile_image_url AS profile_image_url,
          u.is_verified AS is_verified,
          u.role AS role,

          'following' AS pool
        FROM user_follows uf
        JOIN posts p ON p.user_id = uf.following_id
        JOIN users u ON u.id = p.user_id
        WHERE uf.follower_id = ?
      )
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `;

    const { results } = await env.DB.prepare(q).bind(userId, userId, limit).all();

    return json({
      success: true,
      userId,
      limit,
      feed: Array.isArray(results) ? results : [],
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
