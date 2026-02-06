// functions/api/posts.ts  (GUEST FEED)
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

    // guest pagination: cursor is optional (base64 JSON)
    const limit = Math.min(50, Math.max(1, toInt(url.searchParams.get('limit'), 20)));
    const cursor = url.searchParams.get('cursor'); // optional

    let cursorCreatedAt: string | null = null;
    let cursorId: number | null = null;

    if (cursor) {
      try {
        const decoded = JSON.parse(atob(cursor));
        cursorCreatedAt = typeof decoded?.t === 'string' ? decoded.t : null;
        cursorId = Number.isFinite(Number(decoded?.id)) ? Number(decoded.id) : null;
      } catch {
        // ignore bad cursor
      }
    }

    // IMPORTANT: WHERE must be inside the query, not on its own.
    // Also: visibility may be "Public" or "public", so LOWER it.
    const whereVisibility = `LOWER(COALESCE(p.visibility,'public')) IN ('public','')`;

    const whereCursor =
      cursorCreatedAt && cursorId
        ? `AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))`
        : ``;

    const q = `
      SELECT
        p.id,
        p.user_id,
        p.content,

        /* single media (compat) */
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

        /* multi media stored as JSON text */
        CASE
          WHEN p.media_urls LIKE 'data:%' THEN NULL
          WHEN length(p.media_urls) > 5000 THEN NULL
          ELSE p.media_urls
        END AS media_urls,

        CASE
          WHEN length(p.media_types) > 5000 THEN NULL
          ELSE p.media_types
        END AS media_types,

        p.visibility,
        p.created_at,
        p.views,
        p.shares,

        /* author fields */
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.username, 'User') AS name,

        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,

        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

        /* reactions count */
        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count

      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE ${whereVisibility}
      ${whereCursor}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ?
    `;

    const stmt = env.DB.prepare(q);

    const binds: any[] = [];
    if (cursorCreatedAt && cursorId) {
      binds.push(cursorCreatedAt, cursorCreatedAt, cursorId);
    }
    binds.push(limit);

    const { results } = await stmt.bind(...binds).all();
    const rows = Array.isArray(results) ? results : [];

    // Convert JSON strings to arrays & add computed "type" (no DB column needed)
    const posts = rows.map((p: any) => {
      const safeParse = (v: any) => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') {
          try {
            const x = JSON.parse(v);
            return Array.isArray(x) ? x : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      const media_urls = safeParse(p.media_urls);
      const media_types = safeParse(p.media_types);

      const primaryType =
        (typeof p.media_type === 'string' && p.media_type) ||
        (typeof media_types?.[0] === 'string' && media_types[0]) ||
        '';

      const computedType =
        primaryType.startsWith('video/')
          ? 'video'
          : primaryType.startsWith('image/')
            ? 'image'
            : (p.media_url || (media_urls && media_urls.length) ? 'media' : 'text');

      return {
        ...p,
        media_urls,
        media_types,
        type: computedType,
      };
    });

    const hasMore = posts.length === limit;

    const nextCursor =
      hasMore && posts.length
        ? btoa(JSON.stringify({ t: posts[posts.length - 1].created_at, id: posts[posts.length - 1].id }))
        : null;

    return json(
      {
        success: true,
        posts,
        hasMore,
        nextCursor,
      },
      200
    );
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
