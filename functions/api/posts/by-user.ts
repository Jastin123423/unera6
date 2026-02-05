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

const safeString = (v: any) => (typeof v === "string" ? v : "");

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
    
    // pagination cursor (ISO timestamp)
    const cursor = safeString(url.searchParams.get('cursor')).trim();
    
    const limit = Math.min(50, Math.max(1, toInt(url.searchParams.get('limit'), 30)));

    if (!userId) return json({ success: false, error: 'Missing userId' }, 400);

    const where: string[] = [];
    const binds: any[] = [];

    where.push(`p.user_id = ?`);
    binds.push(userId);

    // cursor-based pagination
    if (cursor) {
      where.push(`p.created_at < ?`);
      binds.push(cursor);
    }

    // Optional: visibility filter (public or visible to viewer)
    if (viewerId === userId) {
      // User viewing their own profile - show all posts
      // No additional filter needed
    } else {
      // Others viewing profile - only show public posts
      where.push(`p.visibility = 'public'`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

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

        /* ✅ multi media (JSON strings) */
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

        /* reactions count */
        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,

        /* viewer reaction (safe if viewerId=0) */
        (SELECT pr.type
           FROM post_reactions pr
          WHERE pr.post_id = p.id
            AND pr.user_id = ?
          LIMIT 1
        ) AS my_reaction,

        /* comments count */
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,

        /* author fields */
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.display_name, COALESCE(u.username, 'User')) AS name,

        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,

        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role

      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT ?
    `;

    // bind order: viewerId first (for my_reaction subquery), then where binds, then limit
    const { results } = await env.DB.prepare(q).bind(viewerId || 0, ...binds, limit).all();
    const rows = Array.isArray(results) ? results : [];

    // Parse JSON strings for media arrays
    const posts = rows.map(post => {
      let media_urls: string[] = [];
      let media_types: string[] = [];
      
      try {
        if (post.media_urls && typeof post.media_urls === 'string') {
          media_urls = JSON.parse(post.media_urls);
        }
        if (post.media_types && typeof post.media_types === 'string') {
          media_types = JSON.parse(post.media_types);
        }
      } catch (e) {
        // Keep empty arrays if parsing fails
      }

      // Ensure arrays are of the same length
      const validMediaCount = Math.min(media_urls.length, media_types.length);
      const validMediaUrls = media_urls.slice(0, validMediaCount);
      const validMediaTypes = media_types.slice(0, validMediaCount);

      return {
        ...post,
        media_urls: validMediaUrls,
        media_types: validMediaTypes,
        // Backward compatibility: if media_url is null but media_urls has items, use first
        media_url: post.media_url || (validMediaUrls.length > 0 ? validMediaUrls[0] : null),
        media_type: post.media_type || (validMediaTypes.length > 0 ? validMediaTypes[0] : null),
      };
    });

    // Determine next cursor for pagination
    let nextCursor: string | null = null;
    if (posts.length === limit) {
      const lastPost = posts[posts.length - 1];
      nextCursor = lastPost.created_at;
    }

    return json({
      success: true,
      userId,
      viewerId: viewerId || 0,
      limit,
      cursor,
      nextCursor,
      hasMore: nextCursor !== null,
      posts,
    });
  } catch (e: any) {
    return json({ 
      success: false, 
      error: 'Failed to fetch posts',
      message: e?.message || String(e) 
    }, 500);
  }
};
