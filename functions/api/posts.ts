import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
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

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

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
  if (Array.isArray(v)) {
    return v.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x || "").trim()).filter(Boolean);
      }
    } catch {}
  }
  return [];
};

const normalizeMediaMetaArray = (v: any): any[] => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
  }
  return [];
};

const normCreatedAt = (v: any) => {
  const s = String(v ?? "").trim();
  return s || "1970-01-01 00:00:00";
};

const normalizeMediaType = (v: any, fallback = "image") => {
  const t = String(v || "").trim().toLowerCase();
  if (t === "image" || t === "video" || t === "audio") return t;
  return fallback;
};

const inferTypeFromUrl = (url: string) => {
  const u = String(url || "").toLowerCase();
  if (
    u.includes(".mp4") ||
    u.includes(".webm") ||
    u.includes(".mov") ||
    u.includes(".m3u8")
  ) {
    return "video";
  }
  if (
    u.includes(".mp3") ||
    u.includes(".wav") ||
    u.includes(".ogg") ||
    u.includes(".m4a")
  ) {
    return "audio";
  }
  return "image";
};

const normalizePostMedia = (item: any) => {
  const mediaMeta = normalizeMediaMetaArray(item?.media_meta);
  const mediaUrls = normalizeStringArray(item?.media_urls);
  const mediaTypes = normalizeStringArray(item?.media_types);

  // 1) Best source: media_meta
  if (mediaMeta.length > 0) {
    const normalized = mediaMeta
      .map((m: any) => {
        const thumb = String(m?.thumb || "").trim();
        const feed = String(
          m?.feed || m?.feed_url || m?.url || m?.full || m?.full_url || ""
        ).trim();
        const full = String(
          m?.full || m?.full_url || m?.feed || m?.feed_url || m?.url || ""
        ).trim();

        const chosenType = normalizeMediaType(
          m?.type,
          inferTypeFromUrl(full || feed || thumb)
        );

        return {
          thumb: isHttpUrl(thumb) ? thumb : null,
          feed: isHttpUrl(feed) ? feed : null,
          full: isHttpUrl(full) ? full : null,
          type: chosenType,
        };
      })
      .filter((m: any) => m.thumb || m.feed || m.full);

    if (normalized.length > 0) return normalized;
  }

  // 2) Fallback: media_urls + media_types
  if (mediaUrls.length > 0) {
    const normalized = mediaUrls
      .map((url, i) => {
        const clean = String(url || "").trim();
        if (!isHttpUrl(clean)) return null;

        const t = normalizeMediaType(mediaTypes[i], inferTypeFromUrl(clean));

        return {
          thumb: t === "image" ? clean : null,
          feed: clean,
          full: clean,
          type: t,
        };
      })
      .filter(Boolean);

    if (normalized.length > 0) return normalized;
  }

  // 3) Final fallback: single media_url/media_type
  const singleUrl = String(item?.media_url || "").trim();
  if (isHttpUrl(singleUrl)) {
    const t = normalizeMediaType(item?.media_type, inferTypeFromUrl(singleUrl));
    return [
      {
        thumb: t === "image" ? singleUrl : null,
        feed: singleUrl,
        full: singleUrl,
        type: t,
      },
    ];
  }

  return [];
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

/**
 * POST /api/posts
 * Creates a normal post
 * Supports:
 * - single media_url/media_type
 * - multiple media_urls/media_types
 * - optional media_meta (thumb/feed/full objects)
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        500
      );
    }

    const body = await request.json().catch(() => ({} as any));

    const user_id = safeNumber(body.user_id, 0);
    if (!user_id) {
      return json({ error: "Login required (user_id missing)." }, 401);
    }

    const content = safeString(body.content).trim();

    // single media (backward compatible)
    const media_url = body.media_url ?? null;
    const media_type = body.media_type ?? null;

    // multi media
    const media_urls_arr = normalizeStringArray(body.media_urls);
    const media_types_arr = normalizeStringArray(body.media_types);

    // rich media meta (optional)
    const media_meta_arr = normalizeMediaMetaArray(body.media_meta);

    // Validate and filter simple multi URLs
    const filtered_urls = media_urls_arr
      .filter((u) => !String(u).startsWith("data:"))
      .filter((u) => isHttpUrl(u));

    // Keep types aligned
    const filtered_types: string[] = [];
    for (let i = 0; i < filtered_urls.length; i++) {
      const t = String(media_types_arr[i] || "").trim();
      filtered_types.push(t || "");
    }

    // If media_meta was sent, extract FEED urls first for compatibility
    const mediaMetaFeedUrls = media_meta_arr
      .map((item: any) =>
        String(
          item?.feed ||
            item?.feed_url ||
            item?.url ||
            item?.full ||
            item?.full_url ||
            item?.thumb ||
            ""
        ).trim()
      )
      .filter((u: string) => isHttpUrl(u));

    const mediaMetaTypes = media_meta_arr.map((item: any) =>
      String(item?.type || inferTypeFromUrl(item?.full || item?.feed || item?.thumb || "")).trim()
    );

    const final_multi_urls =
      filtered_urls.length > 0 ? filtered_urls : mediaMetaFeedUrls;

    const final_multi_types =
      filtered_types.length > 0 ? filtered_types : mediaMetaTypes;

    // If multi provided but single missing, prefer FEED url as single preview URL
    const final_media_url =
      typeof media_url === "string" && media_url.trim().length > 0
        ? media_url
        : final_multi_urls[0] ?? null;

    const final_media_type =
      typeof media_type === "string" && media_type.trim().length > 0
        ? media_type
        : final_multi_types[0] ?? null;

    const hasSingle =
      typeof final_media_url === "string" && final_media_url.trim().length > 0;
    const hasMulti = final_multi_urls.length > 0;

    if (!content && !hasSingle && !hasMulti && !body.background) {
      return json(
        { error: "content or media_url or media_urls is required" },
        400
      );
    }

    if (
      typeof final_media_url === "string" &&
      final_media_url.startsWith("data:")
    ) {
      return json(
        {
          error: "Media upload not supported in base64.",
          message:
            "Upload to R2/Cloudflare Images and store a normal https URL in media_url/media_urls.",
        },
        413
      );
    }

    if (
      typeof final_media_url === "string" &&
      final_media_url.length > 0 &&
      !isHttpUrl(final_media_url)
    ) {
      return json({ error: "media_url must be a valid http/https URL" }, 400);
    }

    const media_urls_json = final_multi_urls.length
      ? JSON.stringify(final_multi_urls)
      : null;
    const media_types_json = final_multi_types.length
      ? JSON.stringify(final_multi_types)
      : null;
    const media_meta_json = media_meta_arr.length
      ? JSON.stringify(media_meta_arr)
      : null;

    let result: D1Result<any>;
    let insertedWithMediaMeta = true;

    try {
      result = await env.DB.prepare(
        `INSERT INTO posts (user_id, content, media_url, media_type, media_urls, media_types, media_meta, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          user_id,
          content || null,
          final_media_url,
          final_media_type,
          media_urls_json,
          media_types_json,
          media_meta_json,
          body.visibility ?? "public"
        )
        .run();
    } catch (e: any) {
      insertedWithMediaMeta = false;
      result = await env.DB.prepare(
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
    }

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
          media_meta: insertedWithMediaMeta ? media_meta_json : null,
          media: insertedWithMediaMeta
            ? normalizePostMedia({
                media_url: final_media_url,
                media_type: final_media_type,
                media_urls: media_urls_json,
                media_types: media_types_json,
                media_meta: media_meta_json,
              })
            : normalizePostMedia({
                media_url: final_media_url,
                media_type: final_media_type,
                media_urls: media_urls_json,
                media_types: media_types_json,
              }),
          visibility: body.visibility ?? "public",
          created_at: new Date().toISOString(),
          views: 0,
          shares: 0,
          source: "post",
          item_type: "post",
          feed_key: `post:${post_id}`,
        },
      },
      201
    );
  } catch (err: any) {
    return json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};

/**
 * GET /api/posts
 * Mixed feed for guests and logged users
 * Returns more variety by overfetching each type before merge/sort/slice.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        500
      );
    }

    const url = new URL(request.url);
    const limit = clamp(toInt(url.searchParams.get("limit"), 50), 1, 80);
    const viewerId = toInt(url.searchParams.get("viewerId"), 0);

    const isGuest = viewerId === 0;
    const perType = clamp(
      Math.ceil(limit * (isGuest ? 2.5 : 1.75)),
      12,
      120
    );

    const qPosts = `
      SELECT
        'post' AS source,
        'post' AS item_type,
        p.id AS id,
        ('post:' || CAST(p.id AS TEXT)) AS feed_key,

        p.user_id AS user_id,
        p.content AS content,

        CASE
          WHEN p.media_url LIKE 'data:%' THEN NULL
          WHEN length(p.media_url) > 1000 THEN NULL
          ELSE p.media_url
        END AS media_url,

        CASE
          WHEN p.media_url LIKE 'data:%' THEN NULL
          WHEN length(p.media_url) > 1000 THEN NULL
          ELSE p.media_type
        END AS media_type,

        CASE
          WHEN p.media_urls LIKE 'data:%' THEN NULL
          WHEN length(p.media_urls) > 50000 THEN NULL
          ELSE p.media_urls
        END AS media_urls,

        CASE
          WHEN length(p.media_types) > 20000 THEN NULL
          ELSE p.media_types
        END AS media_types,

        CASE
          WHEN length(p.media_meta) > 100000 THEN NULL
          ELSE p.media_meta
        END AS media_meta,

        p.visibility AS visibility,
        p.created_at AS created_at,
        p.views AS views,
        p.shares AS shares,

        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,
        (SELECT pr.type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = ? LIMIT 1) AS my_reaction,

        (
          SELECT COALESCE(ru.username, '')
          FROM post_reactions pr2
          LEFT JOIN users ru ON ru.id = pr2.user_id
          WHERE pr2.post_id = p.id
          ORDER BY pr2.created_at DESC, pr2.id DESC
          LIMIT 1
        ) AS reactor_name,

        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 500 THEN NULL
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
        NULL AS podcast_plays_count,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image

      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE (p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')
      ORDER BY p.created_at DESC
      LIMIT ?
    `;

    const qReels = `
      SELECT
        'reel' AS source,
        'reel' AS item_type,
        r.id AS id,
        ('reel:' || CAST(r.id AS TEXT)) AS feed_key,

        r.user_id AS user_id,
        NULL AS content,

        r.video_url AS media_url,
        'video' AS media_type,
        NULL AS media_urls,
        NULL AS media_types,
        NULL AS media_meta,

        r.visibility AS visibility,
        r.created_at AS created_at,
        r.views AS views,
        r.shares AS shares,

        (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.id) AS reactions_count,
        (SELECT rl.type FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = ? LIMIT 1) AS my_reaction,

        NULL AS reactor_name,

        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 500 THEN NULL
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
        NULL AS podcast_plays_count,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image

      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE (r.visibility IS NULL OR r.visibility = 'public' OR r.visibility = '' OR r.visibility = 'Public')
      ORDER BY r.created_at DESC
      LIMIT ?
    `;

    const qSongs = `
      SELECT
        'song' AS source,
        'song' AS item_type,
        s.id AS id,
        ('song:' || CAST(s.id AS TEXT)) AS feed_key,

        s.uploader_id AS user_id,
        NULL AS content,

        s.cover_image_url AS media_url,
        'image' AS media_type,
        NULL AS media_urls,
        NULL AS media_types,
        NULL AS media_meta,

        'public' AS visibility,
        s.created_at AS created_at,
        0 AS views,
        0 AS shares,

        (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS reactions_count,
        (SELECT 'like' FROM song_likes sl WHERE sl.song_id = s.id AND sl.user_id = ? LIMIT 1) AS my_reaction,

        NULL AS reactor_name,

        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 500 THEN NULL
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
        NULL AS podcast_plays_count,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image

      FROM songs s
      LEFT JOIN users u ON u.id = s.uploader_id
      ORDER BY s.created_at DESC
      LIMIT ?
    `;

    const qPodcasts = `
      SELECT
        'podcast' AS source,
        'podcast' AS item_type,
        pc.id AS id,
        ('podcast:' || CAST(pc.id AS TEXT)) AS feed_key,

        pc.creator_id AS user_id,
        NULL AS content,

        pc.cover_url AS media_url,
        'image' AS media_type,
        NULL AS media_urls,
        NULL AS media_types,
        NULL AS media_meta,

        'public' AS visibility,
        pc.created_at AS created_at,
        0 AS views,
        0 AS shares,

        0 AS reactions_count,
        NULL AS my_reaction,

        NULL AS reactor_name,

        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 500 THEN NULL
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
        COALESCE(pc.plays_count, 0) AS podcast_plays_count,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image

      FROM podcasts pc
      LEFT JOIN users u ON u.id = pc.creator_id
      ORDER BY pc.created_at DESC
      LIMIT ?
    `;

    const qProducts = `
      SELECT
        'product' AS source,
        'product' AS item_type,
        pr.id AS id,
        ('product:' || CAST(pr.id AS TEXT)) AS feed_key,

        pr.seller_id AS user_id,
        NULL AS content,

        NULL AS media_url,
        NULL AS media_type,
        pr.images AS media_urls,
        NULL AS media_types,
        NULL AS media_meta,

        'public' AS visibility,
        pr.created_at AS created_at,
        0 AS views,
        0 AS shares,

        0 AS reactions_count,
        NULL AS my_reaction,

        NULL AS reactor_name,

        COALESCE(u.username, 'seller') AS username,
        COALESCE(u.name, u.username, 'Seller') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 500 THEN NULL
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
        NULL AS podcast_plays_count,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image

      FROM products pr
      LEFT JOIN users u ON u.id = pr.seller_id
      ORDER BY pr.created_at DESC
      LIMIT ?
    `;

    const qGroupPosts = `
      SELECT
        'group_post' AS source,
        'group_post' AS item_type,
        gp.id AS id,
        ('group_post:' || CAST(gp.id AS TEXT)) AS feed_key,

        gp.user_id AS user_id,
        gp.content AS content,

        CASE
          WHEN gp.media_url LIKE 'data:%' THEN NULL
          WHEN length(gp.media_url) > 1000 THEN NULL
          ELSE gp.media_url
        END AS media_url,

        CASE
          WHEN gp.media_url LIKE '%.mp4%' OR gp.media_url LIKE '%.webm%' OR gp.media_url LIKE '%.mov%'
          THEN 'video'
          WHEN gp.media_url IS NOT NULL AND gp.media_url != ''
          THEN 'image'
          ELSE NULL
        END AS media_type,

        CASE
          WHEN gp.media_url IS NOT NULL AND gp.media_url != '' THEN json_array(gp.media_url)
          ELSE NULL
        END AS media_urls,

        CASE
          WHEN gp.media_url IS NOT NULL AND gp.media_url != '' THEN json_array(
            CASE
              WHEN gp.media_url LIKE '%.mp4%' OR gp.media_url LIKE '%.webm%' OR gp.media_url LIKE '%.mov%' THEN 'video'
              ELSE 'image'
            END
          )
          ELSE NULL
        END AS media_types,

        NULL AS media_meta,

        gp.visibility AS visibility,
        gp.created_at AS created_at,
        0 AS views,
        0 AS shares,

        (SELECT COUNT(*) FROM group_post_likes gpl WHERE gpl.group_post_id = gp.id) AS reactions_count,
        (SELECT 'like' FROM group_post_likes gpl WHERE gpl.group_post_id = gp.id AND gpl.user_id = ? LIMIT 1) AS my_reaction,

        (
          SELECT COALESCE(lu.username, '')
          FROM group_post_likes gpl2
          LEFT JOIN users lu ON lu.id = gpl2.user_id
          WHERE gpl2.group_post_id = gp.id
          ORDER BY gpl2.created_at DESC, gpl2.id DESC
          LIMIT 1
        ) AS reactor_name,

        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 500 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

        CASE
          WHEN gp.media_url LIKE '%.mp4%' OR gp.media_url LIKE '%.webm%' OR gp.media_url LIKE '%.mov%'
          THEN gp.media_url
          ELSE NULL
        END AS video_url,

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
        NULL AS podcast_plays_count,

        gp.group_id AS group_id,
        COALESCE(g.name, 'Group') AS group_name,
        COALESCE(g.profile_image, g.cover_image, NULL) AS group_image

      FROM group_posts gp
      LEFT JOIN users u ON u.id = gp.user_id
      LEFT JOIN groups g ON g.id = gp.group_id
      WHERE (gp.visibility IS NULL OR gp.visibility = 'public')
      ORDER BY gp.created_at DESC
      LIMIT ?
    `;

    const [
      postsRes,
      reelsRes,
      songsRes,
      podcastsRes,
      productsRes,
      groupPostsRes,
    ] = await Promise.all([
      env.DB.prepare(qPosts).bind(viewerId || 0, perType).all(),
      env.DB.prepare(qReels).bind(viewerId || 0, perType).all(),
      env.DB.prepare(qSongs).bind(viewerId || 0, perType).all(),
      env.DB.prepare(qPodcasts).bind(perType).all(),
      env.DB.prepare(qProducts).bind(perType).all(),
      env.DB.prepare(qGroupPosts).bind(viewerId || 0, perType).all(),
    ]);

    const items = [
      ...(Array.isArray(postsRes.results) ? postsRes.results : []),
      ...(Array.isArray(reelsRes.results) ? reelsRes.results : []),
      ...(Array.isArray(songsRes.results) ? songsRes.results : []),
      ...(Array.isArray(podcastsRes.results) ? podcastsRes.results : []),
      ...(Array.isArray(productsRes.results) ? productsRes.results : []),
      ...(Array.isArray(groupPostsRes.results) ? groupPostsRes.results : []),
    ];

    const map = new Map<string, any>();
    for (const it of items) {
      const k = String(it?.feed_key || `${it?.source}:${it?.id}`);
      if (!map.has(k)) map.set(k, it);
    }

    const merged = Array.from(map.values())
      .sort((a, b) =>
        normCreatedAt(b.created_at).localeCompare(normCreatedAt(a.created_at))
      )
      .slice(0, limit)
      .map((item) => {
        const normalizedMedia = normalizePostMedia(item);

        return {
          ...item,
          media: normalizedMedia,
          media_count: normalizedMedia.length,

          // Helpful compatibility fields for frontend
          thumb_url: normalizedMedia[0]?.thumb || null,
          feed_url: normalizedMedia[0]?.feed || null,
          full_url: normalizedMedia[0]?.full || null,
        };
      });

    return json(Array.isArray(merged) ? merged : [], 200);
  } catch (err: any) {
    return json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};
