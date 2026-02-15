// functions/api/by-user.ts
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

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'DB binding missing (DB)' }, 500);

    const url = new URL(request.url);

    const userId = toInt(url.searchParams.get('userId'), 0); // profile owner
    const viewerId = toInt(url.searchParams.get('viewerId'), 0); // current viewer
    const limit = clamp(toInt(url.searchParams.get('limit'), 30), 1, 50);

    if (!userId) return json({ success: false, error: 'Missing userId' }, 400);

    const q = `
      WITH items AS (

        /* ------------------ POSTS (by user) ------------------ */
        SELECT
          'post' AS source,
          'post' AS item_type,

          p.id AS id,
          p.user_id AS user_id,
          p.content AS content,

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

          /* reels fields */
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

          /* product fields (legacy) */
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

          /* song fields */
          NULL AS song_title,
          NULL AS song_artist_name,
          NULL AS song_album_name,
          NULL AS song_cover_image_url,
          NULL AS song_duration_seconds,
          NULL AS song_genre,
          NULL AS song_likes_count,
          NULL AS song_plays_count,

          /* podcast fields */
          NULL AS podcast_title,
          NULL AS podcast_description,
          NULL AS podcast_audio_url,
          NULL AS podcast_cover_url,
          NULL AS podcast_plays_count,

          /* ✅ NEW: feed-compatible marketplace / meta fields */
          NULL AS type,
          NULL AS post_type,
          NULL AS kind,
          NULL AS product_id,
          NULL AS meta,

          /* ✅ NEW: group/event helper fields */
          NULL AS group_id,
          NULL AS event_id

        FROM posts p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ?

        UNION ALL

        /* ------------------ REELS (by user) ------------------ */
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
          NULL AS podcast_plays_count,

          NULL AS type,
          NULL AS post_type,
          NULL AS kind,
          NULL AS product_id,
          NULL AS meta,

          NULL AS group_id,
          NULL AS event_id

        FROM reels r
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.user_id = ?

        UNION ALL

        /* ------------------ SONGS (uploaded by user) ------------------ */
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
          NULL AS podcast_plays_count,

          NULL AS type,
          NULL AS post_type,
          NULL AS kind,
          NULL AS product_id,
          NULL AS meta,

          NULL AS group_id,
          NULL AS event_id

        FROM songs s
        LEFT JOIN users u ON u.id = s.uploader_id
        WHERE s.uploader_id = ?

        UNION ALL

        /* ------------------ PODCASTS (by user) ------------------ */
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
          COALESCE(pc.plays_count, 0) AS podcast_plays_count,

          NULL AS type,
          NULL AS post_type,
          NULL AS kind,
          NULL AS product_id,
          NULL AS meta,

          NULL AS group_id,
          NULL AS event_id

        FROM podcasts pc
        LEFT JOIN users u ON u.id = pc.creator_id
        WHERE pc.creator_id = ?

        UNION ALL

        /* ------------------ EVENTS (created by user) ------------------ */
        SELECT
          'event' AS source,
          'event' AS item_type,

          e.id AS id,
          e.creator_id AS user_id,
          e.title AS content,

          CASE
            WHEN e.cover_url LIKE 'data:%' THEN NULL
            WHEN length(e.cover_url) > 300 THEN NULL
            ELSE e.cover_url
          END AS media_url,

          CASE
            WHEN e.cover_url IS NOT NULL AND e.cover_url != '' THEN 'image'
            ELSE NULL
          END AS media_type,

          CASE
            WHEN e.cover_url IS NOT NULL AND e.cover_url != ''
            THEN json_array(e.cover_url)
            ELSE NULL
          END AS media_urls,

          CASE
            WHEN e.cover_url IS NOT NULL AND e.cover_url != ''
            THEN json_array('image')
            ELSE NULL
          END AS media_types,

          'public' AS visibility,
          e.created_at AS created_at,
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
          NULL AS audio_url,
          0 AS audio_start,
          0 AS audio_end,
          e.location AS location,
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

          NULL AS type,
          NULL AS post_type,
          NULL AS kind,
          NULL AS product_id,
          NULL AS meta,

          e.group_id AS group_id,
          e.id AS event_id

        FROM events e
        LEFT JOIN users u ON u.id = e.creator_id
        WHERE e.creator_id = ?

        UNION ALL

        /* ------------------ GROUP POSTS (by user) ------------------ */
        SELECT
          'group_post' AS source,
          'post' AS item_type,

          gp.id AS id,
          gp.user_id AS user_id,
          gp.content AS content,

          CASE
            WHEN gp.media_url LIKE 'data:%' THEN NULL
            WHEN length(gp.media_url) > 300 THEN NULL
            ELSE gp.media_url
          END AS media_url,

          CASE
            WHEN gp.media_url LIKE 'data:%' THEN NULL
            WHEN length(gp.media_url) > 300 THEN NULL
            ELSE
              CASE
                WHEN gp.media_url LIKE '%.mp4%' OR gp.media_url LIKE '%.webm%' OR gp.media_url LIKE '%.mov%' THEN 'video'
                ELSE 'image'
              END
          END AS media_type,

          CASE
            WHEN gp.media_url IS NOT NULL AND gp.media_url != ''
            THEN json_array(gp.media_url)
            ELSE NULL
          END AS media_urls,

          CASE
            WHEN gp.media_url IS NOT NULL AND gp.media_url != ''
            THEN json_array(
              CASE
                WHEN gp.media_url LIKE '%.mp4%' OR gp.media_url LIKE '%.webm%' OR gp.media_url LIKE '%.mov%' THEN 'video'
                ELSE 'image'
              END
            )
            ELSE NULL
          END AS media_types,

          'public' AS visibility,
          gp.created_at AS created_at,
          0 AS views,
          0 AS shares,

          (SELECT COUNT(*) FROM group_post_likes gpl WHERE gpl.group_post_id = gp.id) AS reactions_count,
          (SELECT 'like'
             FROM group_post_likes gpl
            WHERE gpl.group_post_id = gp.id
              AND gpl.user_id = ?
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

          CASE
            WHEN gp.media_url LIKE '%.mp4%' OR gp.media_url LIKE '%.webm%' OR gp.media_url LIKE '%.mov%' THEN gp.media_url
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

          NULL AS type,
          NULL AS post_type,
          NULL AS kind,
          NULL AS product_id,
          NULL AS meta,

          gp.group_id AS group_id,
          NULL AS event_id

        FROM group_posts gp
        LEFT JOIN users u ON u.id = gp.user_id
        WHERE gp.user_id = ?

        UNION ALL

        /* ------------------ PRODUCTS (by user) ------------------ */
        SELECT
          'product' AS source,
          'post' AS item_type,

          pr.id AS id,
          pr.seller_id AS user_id,
          pr.title AS content,

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
          NULL AS podcast_plays_count,

          /* ✅ IMPORTANT: these make "View product" work in profile too */
          'marketplace' AS type,
          'product' AS post_type,
          'product' AS kind,
          pr.id AS product_id,
          json_object(
            'kind','product',
            'type','product',
            'product_id', pr.id,
            'marketplace', json_object('id', pr.id)
          ) AS meta,

          NULL AS group_id,
          NULL AS event_id

        FROM products pr
        LEFT JOIN users u ON u.id = pr.seller_id
        WHERE pr.seller_id = ?
      )
      SELECT * FROM items
      ORDER BY created_at DESC
      LIMIT ?
    `;

    // Bind order EXACTLY:
    // posts: viewerId, userId
    // reels: viewerId, userId
    // songs: viewerId, userId
    // podcasts: userId
    // events: userId
    // group_posts: viewerId, userId
    // products: userId
    // limit
    const binds = [
      viewerId || 0, userId,
      viewerId || 0, userId,
      viewerId || 0, userId,
      userId,
      userId,
      viewerId || 0, userId,
      userId,
      limit,
    ];

    const { results } = await env.DB.prepare(q).bind(...binds).all();

    // ✅ RAW ARRAY RESPONSE (as requested)
    return json(Array.isArray(results) ? results : [], 200);
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
