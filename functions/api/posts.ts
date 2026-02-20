Provide me full posts.ts
// functions/api/posts.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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

const toInt = (v: any, fallback = 0) => {
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
    } catch {}
  }
  return [];
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

/**
 * POST /api/posts
 * Creates a normal post (unchanged behavior)
 */
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
      .filter((u) => !String(u).startsWith("data:"))
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
        body.visibility ?? "public"
      )
      .run();

    const post_id = result.meta?.last_row_id;

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
          media_urls: media_urls_json,
          media_types: media_types_json,
          visibility: body.visibility ?? "public",
          created_at: new Date().toISOString(),
          views: 0,
          shares: 0,
          // unified fields
          source: "post",
          item_type: "post",
        },
      },
      201
    );
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};

/**
 * GET /api/posts
 * ✅ RETURNS RAW ARRAY (NOT OBJECT)
 * Includes: posts + reels + songs + podcasts + products (NO groups)
 * Query params:
 * - limit (default 50)
 * - viewerId (optional, for my_reaction)
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ error: "D1 binding missing. Set Pages D1 binding name to DB." }, 500);

    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const viewerId = toInt(url.searchParams.get("viewerId"), 0);

    // NOTE: We keep shapes compatible with "posts":
    // - includes media_url/media_type/media_urls/media_types/content/created_at/visibility/username/profile_image_url/etc
    // - adds item_type + source so UI can branch if needed (but doesn't have to)
    const q = `
      WITH items AS (

        /* ------------------ POSTS ------------------ */
        SELECT
          'post' AS source,
          'post' AS item_type,

          p.id AS id,
          p.user_id AS user_id,
          p.content AS content,

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

          CASE
            WHEN p.media_urls LIKE 'data:%' THEN NULL
            WHEN length(p.media_urls) > 5000 THEN NULL
            ELSE p.media_urls
          END AS media_urls,

          CASE
            WHEN length(p.media_types) > 5000 THEN NULL
            ELSE p.media_types
          END AS media_types,

          p.visibility AS visibility,
          p.created_at AS created_at,
          p.views AS views,
          p.shares AS shares,

          (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,
          (SELECT pr.type
             FROM post_reactions pr
            WHERE pr.post_id = p.id
              AND pr.user_id = ?
            LIMIT 1
          ) AS my_reaction,

          COALESCE(u.username, 'user') AS username,
          COALESCE(u.username, 'User') AS name,
          CASE
            WHEN u.profile_image_url LIKE 'data:%' THEN NULL
            WHEN length(u.profile_image_url) > 300 THEN NULL
            ELSE u.profile_image_url
          END AS profile_image_url,
          COALESCE(u.is_verified, 0) AS is_verified,
          COALESCE(u.role, 'user') AS role,

          /* extra unified fields */
          NULL AS video_url,
          NULL AS caption,
          NULL AS song_name,
          NULL AS audio_url,
          0 AS audio_start,
          0 AS audio_end,
          NULL AS location,
          NULL AS song_id,
          NULL AS sound_key,
          NULL AS sound_id,

          NULL AS product_title,
          NULL AS product_category,
          NULL AS product_description,
          NULL AS product_country,
          NULL AS product_address,
          NULL AS product_main_price,
          NULL AS product_discount_price,
          NULL AS product_quantity,
          NULL AS product_phone_number,
          NULL AS product_images,

          NULL AS song_title,
          NULL AS song_artist_name,
          NULL AS song_album_name,
          NULL AS song_cover_image_url,
          NULL AS song_duration_seconds,
          NULL AS song_genre,
          NULL AS song_likes_count,
          NULL AS song_plays_count,

          NULL AS podcast_title,
          NULL AS podcast_description,
          NULL AS podcast_audio_url,
          NULL AS podcast_cover_url,
          NULL AS podcast_plays_count

        FROM posts p
        LEFT JOIN users u ON u.id = p.user_id

        UNION ALL

        /* ------------------ REELS ------------------ */
        SELECT
          'reel' AS source,
          'reel' AS item_type,

          r.id AS id,
          r.user_id AS user_id,
          NULL AS content,

          r.video_url AS media_url,
          'video' AS media_type,
          NULL AS media_urls,
          NULL AS media_types,

          r.visibility AS visibility,
          r.created_at AS created_at,
          r.views AS views,
          r.shares AS shares,

          (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.id) AS reactions_count,
          (SELECT rl.type
             FROM reel_likes rl
            WHERE rl.reel_id = r.id
              AND rl.user_id = ?
            LIMIT 1
          ) AS my_reaction,

          COALESCE(u.username, 'user') AS username,
          COALESCE(u.username, 'User') AS name,
          CASE
            WHEN u.profile_image_url LIKE 'data:%' THEN NULL
            WHEN length(u.profile_image_url) > 300 THEN NULL
            ELSE u.profile_image_url
          END AS profile_image_url,
          COALESCE(u.is_verified, 0) AS is_verified,
          COALESCE(u.role, 'user') AS role,

          r.video_url AS video_url,
          r.caption AS caption,
          r.song_name AS song_name,
          r.audio_url AS audio_url,
          COALESCE(r.audio_start, 0) AS audio_start,
          COALESCE(r.audio_end, 0) AS audio_end,
          r.location AS location,
          r.song_id AS song_id,
          r.sound_key AS sound_key,
          r.sound_id AS sound_id,

          NULL AS product_title,
          NULL AS product_category,
          NULL AS product_description,
          NULL AS product_country,
          NULL AS product_address,
          NULL AS product_main_price,
          NULL AS product_discount_price,
          NULL AS product_quantity,
          NULL AS product_phone_number,
          NULL AS product_images,

          NULL AS song_title,
          NULL AS song_artist_name,
          NULL AS song_album_name,
          NULL AS song_cover_image_url,
          NULL AS song_duration_seconds,
          NULL AS song_genre,
          NULL AS song_likes_count,
          NULL AS song_plays_count,

          NULL AS podcast_title,
          NULL AS podcast_description,
          NULL AS podcast_audio_url,
          NULL AS podcast_cover_url,
          NULL AS podcast_plays_count

        FROM reels r
        LEFT JOIN users u ON u.id = r.user_id

        UNION ALL

        /* ------------------ SONGS ------------------ */
        SELECT
          'song' AS source,
          'song' AS item_type,

          s.id AS id,
          s.uploader_id AS user_id,
          NULL AS content,

          s.cover_image_url AS media_url,
          'image' AS media_type,
          NULL AS media_urls,
          NULL AS media_types,

          'public' AS visibility,
          s.created_at AS created_at,
          0 AS views,
          0 AS shares,

          (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS reactions_count,
          (SELECT 'like'
             FROM song_likes sl
            WHERE sl.song_id = s.id
              AND sl.user_id = ?
            LIMIT 1
          ) AS my_reaction,

          COALESCE(u.username, 'user') AS username,
          COALESCE(u.username, 'User') AS name,
          CASE
            WHEN u.profile_image_url LIKE 'data:%' THEN NULL
            WHEN length(u.profile_image_url) > 300 THEN NULL
            ELSE u.profile_image_url
          END AS profile_image_url,
          COALESCE(u.is_verified, 0) AS is_verified,
          COALESCE(u.role, 'user') AS role,

          NULL AS video_url,
          NULL AS caption,
          NULL AS song_name,
          s.audio_url AS audio_url,
          0 AS audio_start,
          0 AS audio_end,
          NULL AS location,
          NULL AS song_id,
          NULL AS sound_key,
          NULL AS sound_id,

          NULL AS product_title,
          NULL AS product_category,
          NULL AS product_description,
          NULL AS product_country,
          NULL AS product_address,
          NULL AS product_main_price,
          NULL AS product_discount_price,
          NULL AS product_quantity,
          NULL AS product_phone_number,
          NULL AS product_images,

          s.title AS song_title,
          s.artist_name AS song_artist_name,
          s.album_name AS song_album_name,
          s.cover_image_url AS song_cover_image_url,
          s.duration_seconds AS song_duration_seconds,
          s.genre AS song_genre,
          (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS song_likes_count,
          (
            (SELECT COUNT(*) FROM song_play_events spe WHERE spe.song_id = s.id)
            +
            (SELECT COUNT(*) FROM song_plays sp WHERE sp.song_id = s.id)
          ) AS song_plays_count,

          NULL AS podcast_title,
          NULL AS podcast_description,
          NULL AS podcast_audio_url,
          NULL AS podcast_cover_url,
          NULL AS podcast_plays_count

        FROM songs s
        LEFT JOIN users u ON u.id = s.uploader_id

        UNION ALL

        /* ------------------ PODCASTS ------------------ */
        SELECT
          'podcast' AS source,
          'podcast' AS item_type,

          pc.id AS id,
          pc.creator_id AS user_id,
          NULL AS content,

          pc.cover_url AS media_url,
          'image' AS media_type,
          NULL AS media_urls,
          NULL AS media_types,

          'public' AS visibility,
          pc.created_at AS created_at,
          0 AS views,
          0 AS shares,

          0 AS reactions_count,
          NULL AS my_reaction,

          COALESCE(u.username, 'user') AS username,
          COALESCE(u.username, 'User') AS name,
          CASE
            WHEN u.profile_image_url LIKE 'data:%' THEN NULL
            WHEN length(u.profile_image_url) > 300 THEN NULL
            ELSE u.profile_image_url
          END AS profile_image_url,
          COALESCE(u.is_verified, 0) AS is_verified,
          COALESCE(u.role, 'user') AS role,

          NULL AS video_url,
          NULL AS caption,
          NULL AS song_name,
          pc.audio_url AS audio_url,
          0 AS audio_start,
          0 AS audio_end,
          NULL AS location,
          NULL AS song_id,
          NULL AS sound_key,
          NULL AS sound_id,

          NULL AS product_title,
          NULL AS product_category,
          NULL AS product_description,
          NULL AS product_country,
          NULL AS product_address,
          NULL AS product_main_price,
          NULL AS product_discount_price,
          NULL AS product_quantity,
          NULL AS product_phone_number,
          NULL AS product_images,

          NULL AS song_title,
          NULL AS song_artist_name,
          NULL AS song_album_name,
          NULL AS song_cover_image_url,
          NULL AS song_duration_seconds,
          NULL AS song_genre,
          NULL AS song_likes_count,
          NULL AS song_plays_count,

          pc.title AS podcast_title,
          pc.description AS podcast_description,
          pc.audio_url AS podcast_audio_url,
          pc.cover_url AS podcast_cover_url,
          COALESCE(pc.plays_count, 0) AS podcast_plays_count

        FROM podcasts pc
        LEFT JOIN users u ON u.id = pc.creator_id

        UNION ALL

        /* ------------------ PRODUCTS ------------------ */
        SELECT
          'product' AS source,
          'product' AS item_type,

          pr.id AS id,
          pr.seller_id AS user_id,
          NULL AS content,

          NULL AS media_url,
          NULL AS media_type,
          pr.images AS media_urls,
          NULL AS media_types,

          'public' AS visibility,
          pr.created_at AS created_at,
          0 AS views,
          0 AS shares,

          0 AS reactions_count,
          NULL AS my_reaction,

          COALESCE(u.username, 'seller') AS username,
          COALESCE(u.username, 'Seller') AS name,
          CASE
            WHEN u.profile_image_url LIKE 'data:%' THEN NULL
            WHEN length(u.profile_image_url) > 300 THEN NULL
            ELSE u.profile_image_url
          END AS profile_image_url,
          COALESCE(u.is_verified, 0) AS is_verified,
          COALESCE(u.role, 'user') AS role,

          NULL AS video_url,
          NULL AS caption,
          NULL AS song_name,
          NULL AS audio_url,
          0 AS audio_start,
          0 AS audio_end,
          NULL AS location,
          NULL AS song_id,
          NULL AS sound_key,
          NULL AS sound_id,

          pr.title AS product_title,
          pr.category AS product_category,
          pr.description AS product_description,
          pr.country AS product_country,
          pr.address AS product_address,
          pr.main_price AS product_main_price,
          pr.discount_price AS product_discount_price,
          pr.quantity AS product_quantity,
          pr.phone_number AS product_phone_number,
          pr.images AS product_images,

          NULL AS song_title,
          NULL AS song_artist_name,
          NULL AS song_album_name,
          NULL AS song_cover_image_url,
          NULL AS song_duration_seconds,
          NULL AS song_genre,
          NULL AS song_likes_count,
          NULL AS song_plays_count,

          NULL AS podcast_title,
          NULL AS podcast_description,
          NULL AS podcast_audio_url,
          NULL AS podcast_cover_url,
          NULL AS podcast_plays_count

        FROM products pr
        LEFT JOIN users u ON u.id = pr.seller_id
      )
      SELECT * FROM items
      ORDER BY created_at DESC
      LIMIT ?
    `;

    // Bind order matches ? in the query:
    // posts viewerId
    // reels viewerId
    // songs viewerId
    // limit
    const binds = [viewerId || 0, viewerId || 0, viewerId || 0, limit];

    const { results } = await env.DB.prepare(q).bind(...binds).all();

    // ✅ RAW ARRAY RESPONSE
    return json(Array.isArray(results) ? results : [], 200);
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};
