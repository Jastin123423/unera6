import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const safeString = (v: any) => (typeof v === "string" ? v : "");
const safeNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const isHttpUrl = (v: any) => {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeStringArray = (v: any): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof v === "string") {
    // allow JSON string
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x || "").trim()).filter(Boolean);
    } catch { }
  }
  return [];
};

const parseMediaArrays = (post: any) => {
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
    // Backward compatibility
    media_url: post.media_url || (validMediaUrls.length > 0 ? validMediaUrls[0] : null),
    media_type: post.media_type || (validMediaTypes.length > 0 ? validMediaTypes[0] : null),
  };
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ error: "D1 binding missing. Set Pages D1 binding name to DB." }, 500);

    const body = await request.json().catch(() => ({} as any));

    const user_id = safeNumber(body.user_id, 0);
    if (!user_id) return json({ error: "Login required (user_id missing)." }, 401);

    const content = safeString(body.content).trim();

    // single media (backward compatible)
    const media_url = body.media_url ?? null;
    const media_type = body.media_type ?? null;

    // multi media (new)
    const media_urls_arr = normalizeStringArray(body.media_urls);
    const media_types_arr = normalizeStringArray(body.media_types);

    // Validate and filter multi URLs
    const filtered_urls = media_urls_arr
      .filter((u) => !u.startsWith("data:"))
      .filter((u) => isHttpUrl(u));

    // Keep types aligned (best-effort)
    const filtered_types: string[] = [];
    for (let i = 0; i < filtered_urls.length; i++) {
      const t = String(media_types_arr[i] || "").trim();
      filtered_types.push(t || "");
    }

    // If multi provided but single missing, set single = first (compat)
    const final_media_url =
      typeof media_url === "string" && media_url.trim().length > 0
        ? media_url
        : (filtered_urls[0] ?? null);

    const final_media_type =
      typeof media_type === "string" && media_type.trim().length > 0
        ? media_type
        : (filtered_types[0] ?? null);

    // ✅ Required: content OR any media
    const hasSingle = typeof final_media_url === "string" && final_media_url.trim().length > 0;
    const hasMulti = filtered_urls.length > 0;

    if (!content && !hasSingle && !hasMulti) {
      return json({ error: "content or media_url or media_urls is required" }, 400);
    }

    // ✅ BLOCK base64 uploads
    if (typeof final_media_url === "string" && final_media_url.startsWith("data:")) {
      return json(
        {
          error: "Media upload not supported in base64.",
          message: "Upload to R2/Cloudflare Images and store a normal https URL in media_url/media_urls.",
        },
        413
      );
    }

    // Optional: only allow normal URLs if media_url exists
    if (typeof final_media_url === "string" && final_media_url.length > 0) {
      if (!isHttpUrl(final_media_url)) {
        return json({ error: "media_url must be a valid http/https URL" }, 400);
      }
    }

    // store arrays as JSON text in D1
    const media_urls_json = filtered_urls.length ? JSON.stringify(filtered_urls) : null;
    const media_types_json = filtered_urls.length ? JSON.stringify(filtered_types) : null;

    // ✅ Insert includes multi fields (requires columns exist in D1)
    const result = await env.DB.prepare(
      `INSERT INTO posts (user_id, content, media_url, media_type, media_urls, media_types, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        user_id,
        content || null,
        final_media_url,
        final_media_type,
        media_urls_json,
        media_types_json,
        body.visibility || "public"
      )
      .run();

    const post_id = result.meta?.last_row_id;

    // Return a post object (helps UI show immediately)
    return json(
      {
        success: true,
        post_id,
        post: {
          id: post_id,
          user_id,
          content: content || "",
          media_url: final_media_url,
          media_type: final_media_type,
          media_urls: filtered_urls,
          media_types: filtered_types,
          visibility: body.visibility || "public",
          created_at: new Date().toISOString(),
          views: 0,
          shares: 0,
          reactions_count: 0,
          comments_count: 0,
          my_reaction: null,
        },
      },
      201
    );
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ error: "D1 binding missing. Set Pages D1 binding name to DB." }, 500);

    const url = new URL(request.url);

    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const cursor = safeString(url.searchParams.get("cursor")).trim();
    const viewerId = safeNumber(url.searchParams.get("viewerId"), 0); // for my_reaction

    const where: string[] = [];
    const binds: any[] = [];

    // public only (match feeds behavior)
    where.push(`(p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')`);

    if (cursor) {
      where.push(`p.created_at < ?`);
      binds.push(cursor);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

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

        /* multi media (JSON strings) */
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

        /* viewer reaction */
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

    // Bind order: viewerId, then where binds, then limit
    const { results } = await env.DB.prepare(q).bind(viewerId, ...binds, limit).all();
    const rows = Array.isArray(results) ? results : [];

    // Parse media arrays for each post
    const posts = rows.map(parseMediaArrays);

    // Determine next cursor for pagination
    let nextCursor: string | null = null;
    if (posts.length === limit) {
      const lastPost = posts[posts.length - 1];
      nextCursor = lastPost.created_at;
    }

    // Check if there are more posts
    let hasMore = false;
    if (nextCursor) {
      const qMore = `
        SELECT p.id
        FROM posts p
        WHERE (p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')
          AND p.created_at < ?
        ORDER BY p.created_at DESC
        LIMIT 1
      `;

      const more = await env.DB.prepare(qMore).bind(nextCursor).first();
      hasMore = !!more;
    }

    return json({
      success: true,
      limit,
      cursor: cursor || null,
      nextCursor,
      hasMore,
      viewerId,
      posts,
    }, 200);
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ error: "D1 binding missing. Set Pages D1 binding name to DB." }, 500);

    const url = new URL(request.url);
    const postId = safeNumber(url.searchParams.get("postId"), 0);
    const userId = safeNumber(url.searchParams.get("userId"), 0);

    if (!postId || !userId) {
      return json({ error: "postId and userId are required" }, 400);
    }

    // Check if post exists and belongs to user
    const post = await env.DB.prepare(
      "SELECT id FROM posts WHERE id = ? AND user_id = ?"
    ).bind(postId, userId).first();

    if (!post) {
      return json({ error: "Post not found or you don't have permission to delete it" }, 404);
    }

    // Delete post reactions first (foreign key constraint)
    await env.DB.prepare("DELETE FROM post_reactions WHERE post_id = ?").bind(postId).run();

    // Delete post comments first
    await env.DB.prepare("DELETE FROM comments WHERE post_id = ?").bind(postId).run();

    // Delete the post
    await env.DB.prepare("DELETE FROM posts WHERE id = ? AND user_id = ?").bind(postId, userId).run();

    return json({
      success: true,
      message: "Post deleted successfully",
      postId
    }, 200);
  } catch (err: any) {
    return json({ error: "Failed to delete post", message: String(err?.message ?? err) }, 500);
  }
};
