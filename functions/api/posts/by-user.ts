// functions/api/posts/by-user.ts
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

    // profile owner (whose posts)
    const userId = toInt(url.searchParams.get('userId'), 0);

    // viewer (who is logged in) - used for my_reaction highlight
    const viewerId = toInt(url.searchParams.get('viewerId'), 0);

    const limit = Math.min(50, Math.max(1, toInt(url.searchParams.get('limit'), 30)));

    if (!userId) return json({ success: false, error: 'Missing userId' }, 400);

    const q = `
      SELECT
        p.id,
        p.user_id,
        p.content,

        CASE
          WHEN p.media_url LIKE 'data:%' THEN NULL
          WHEN length(p.media_url) > 300 THEN NULL
          ELSE p.media_url
        END AS media_url,

        CASE
          WHEN p.media_url LIKE 'data:%' THEN NULL
          WHEN length(p.media_url) > 300 THEN NULL
          ELSE p.media_type
        END AS media_type,

        p.visibility,
        p.created_at,
        p.views,
        p.shares,

        -- ✅ reactions count
        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,

        -- ✅ viewer reaction (safe if viewerId=0)
        (SELECT pr.type
           FROM post_reactions pr
          WHERE pr.post_id = p.id
            AND pr.user_id = ?
          LIMIT 1
        ) AS my_reaction,

        -- ✅ author fields (helps profile posts render consistently)
        COALESCE(u.username, 'user') AS username,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role

      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `;

    // ✅ Bind order: viewerId for my_reaction, then userId, then limit
    const { results } = await env.DB.prepare(q).bind(viewerId || 0, userId, limit).all();

    return json({
      success: true,
      userId,
      viewerId: viewerId || 0,
      limit,
      posts: Array.isArray(results) ? results : [],
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
