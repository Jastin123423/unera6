// functions/api/by-user.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const toInt = (v: any, fallback = 0) => {
  const s = String(v ?? "").trim();
  if (!s || s === "undefined" || s === "null") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const safeStr = (v: any) => String(v ?? "");

const normCreatedAt = (v: any) => {
  const s = safeStr(v).trim();
  return s || "1970-01-01 00:00:00";
};

const sortDescByCreatedAt = (a: any, b: any) =>
  normCreatedAt(b.created_at).localeCompare(normCreatedAt(a.created_at));

/* ============================================================
   ✅ Multi-media helpers (same as feeds.ts)
============================================================ */

const cleanUrl = (v: any) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s === "null" || s === "undefined") return "";
  if (s.startsWith("data:")) return "";
  return s;
};

const parseJsonArrayUrls = (raw: any, maxItems = 20): string[] => {
  if (Array.isArray(raw)) return raw.map(cleanUrl).filter(Boolean).slice(0, maxItems);

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    if (s.length > 10000) return [];
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(cleanUrl).filter(Boolean).slice(0, maxItems);
      } catch {}
      return [];
    }
    const one = cleanUrl(s);
    return one ? [one] : [];
  }

  return [];
};

const parseJsonArrayStrings = (raw: any, maxItems = 20): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x ?? "").trim())
      .filter((x) => x && x !== "null" && x !== "undefined")
      .slice(0, maxItems);
  }

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    if (s.length > 10000) return [];
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed
            .map((x) => String(x ?? "").trim())
            .filter((x) => x && x !== "null" && x !== "undefined")
            .slice(0, maxItems);
        }
      } catch {}
      return [];
    }

    const one = String(s).trim();
    return one ? [one] : [];
  }

  return [];
};

const guessTypeFromUrl = (url: string) => {
  const u = url.toLowerCase();
  if (u.includes(".mp4") || u.includes(".webm") || u.includes(".mov")) return "video";
  if (u.includes(".mp3") || u.includes(".wav") || u.includes(".m4a")) return "audio";
  return "image";
};

const normalizeMedia = (row: any) => {
  const single = cleanUrl(row?.media_url);

  const urls = parseJsonArrayUrls(row?.media_urls);
  const outUrls = urls.length ? urls : single ? [single] : [];

  const types = parseJsonArrayStrings(row?.media_types);
  let outTypes = types.length ? types : [];

  if (outUrls.length && outTypes.length !== outUrls.length) {
    outTypes = outUrls.map(guessTypeFromUrl);
  }

  return {
    media_url: single || null,
    media_urls: outUrls,
    media_types: outTypes,
    images: outUrls,
  };
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/* ============================================================
   GET /api/by-user  ✅ feeds-compatible (NO groups)
   ✅ never errors on missing ids: returns empty feed
============================================================ */

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const url = new URL(request.url);

    const viewerId = toInt(url.searchParams.get("viewerId"), 0);

    // ✅ accept multiple keys
    const explicitUserId =
      toInt(url.searchParams.get("userId"), 0) ||
      toInt(url.searchParams.get("id"), 0) ||
      toInt(url.searchParams.get("profileId"), 0) ||
      toInt(url.searchParams.get("profileUserId"), 0);

    // ✅ fallback to viewerId (my profile)
    const userId = explicitUserId || (viewerId > 0 ? viewerId : 0);

    const limit = clamp(toInt(url.searchParams.get("limit"), 30), 1, 50);

    // ✅ IMPORTANT: don't crash UI
    if (!userId) {
      return json(
        {
          success: true,
          userId: 0,
          viewerId: viewerId || 0,
          feed: [],
          warning:
            "Missing userId/viewerId in request. Pass ?userId=123 (or viewerId for own profile). Returning empty feed to avoid UI crash.",
        },
        200
      );
    }

    const perType = clamp(Math.ceil(limit * 1.7), 10, 80);
    const reactionUserId = viewerId || 0;

    // POSTS
    const qPosts = `
      SELECT
        'post' AS source,
        'post' AS item_type,
        p.id AS id,
        ('post:' || CAST(p.id AS TEXT)) AS feed_key,
        p.created_at AS created_at,

        p.id AS post_id,
        NULL AS reel_id,
        NULL AS song_id2,
        NULL AS podcast_id,
        NULL AS event_id,
        NULL AS group_post_id,
        NULL AS product_id2,

        p.user_id AS user_id,
        COALESCE(u.username,'user') AS username,
        COALESCE(u.name, u.username,'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified,0) AS is_verified,
        COALESCE(u.role,'user') AS role,

        p.content AS content,
        p.visibility AS visibility,
        p.views AS views,
        p.shares AS shares,

        CASE
          WHEN p.media_url LIKE 'data:%' THEN NULL
          WHEN length(p.media_url) > 300 THEN NULL
          ELSE p.media_url
        END AS media_url,

        CASE
          WHEN length(p.media_type) > 80 THEN NULL
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

        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,

        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,
        (SELECT pr.type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = ? LIMIT 1) AS my_reaction,

        (
          SELECT COALESCE(u2.name, u2.username, '')
          FROM post_reactions pr2
          JOIN users u2 ON u2.id = pr2.user_id
          WHERE pr2.post_id = p.id
          ORDER BY pr2.created_at DESC, pr2.id DESC
          LIMIT 1
        ) AS reactor_name,

        NULL AS reactions_preview,
        NULL AS reactions_by_type,

        NULL AS video_url,
        NULL AS caption,
        NULL AS song_name,
        NULL AS audio_url,
        0 AS audio_start,
        0 AS audio_end,
        NULL AS location,
        NULL AS sound_key,
        NULL AS sound_id,

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
        NULL AS meta,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT ?
    `;

    // REELS
    const qReels = `
      SELECT
        'reel' AS source,
        'reel' AS item_type,
        r.id AS id,
        ('reel:' || CAST(r.id AS TEXT)) AS feed_key,
        r.created_at AS created_at,

        NULL AS post_id,
        r.id AS reel_id,
        NULL AS song_id2,
        NULL AS podcast_id,
        NULL AS event_id,
        NULL AS group_post_id,
        NULL AS product_id2,

        r.user_id AS user_id,
        COALESCE(u.username,'user') AS username,
        COALESCE(u.name, u.username,'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified,0) AS is_verified,
        COALESCE(u.role,'user') AS role,

        NULL AS content,
        r.visibility AS visibility,
        r.views AS views,
        r.shares AS shares,

        r.video_url AS media_url,
        'video' AS media_type,
        NULL AS media_urls,
        NULL AS media_types,

        0 AS comments_count,

        (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.id) AS reactions_count,
        (SELECT rl.type FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = ? LIMIT 1) AS my_reaction,

        NULL AS reactor_name,
        NULL AS reactions_preview,
        NULL AS reactions_by_type,

        r.video_url AS video_url,
        r.caption AS caption,
        r.song_name AS song_name,
        r.audio_url AS audio_url,
        COALESCE(r.audio_start,0) AS audio_start,
        COALESCE(r.audio_end,0) AS audio_end,
        r.location AS location,
        r.sound_key AS sound_key,
        r.sound_id AS sound_id,

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
        NULL AS meta,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT ?
    `;

    // SONGS (music)
    const qSongs = `
      SELECT
        'song' AS source,
        'song' AS item_type,
        s.id AS id,
        ('song:' || CAST(s.id AS TEXT)) AS feed_key,
        s.created_at AS created_at,

        NULL AS post_id,
        NULL AS reel_id,
        s.id AS song_id2,
        NULL AS podcast_id,
        NULL AS event_id,
        NULL AS group_post_id,
        NULL AS product_id2,

        s.uploader_id AS user_id,
        COALESCE(u.username,'user') AS username,
        COALESCE(u.name, u.username,'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified,0) AS is_verified,
        COALESCE(u.role,'user') AS role,

        (
          COALESCE(s.title,'')
          || CASE
               WHEN s.artist_name IS NOT NULL AND s.artist_name != '' THEN ' — ' || s.artist_name
               ELSE ''
             END
        ) AS content,

        'public' AS visibility,
        0 AS views,
        0 AS shares,

        s.audio_url AS media_url,
        'audio/mpeg' AS media_type,

        CASE
          WHEN s.cover_image_url IS NOT NULL AND s.cover_image_url != ''
          THEN json_array(s.cover_image_url)
          ELSE NULL
        END AS media_urls,

        CASE
          WHEN s.cover_image_url IS NOT NULL AND s.cover_image_url != ''
          THEN json_array('image')
          ELSE NULL
        END AS media_types,

        0 AS comments_count,

        (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS reactions_count,
        (SELECT 'like' FROM song_likes sl WHERE sl.song_id = s.id AND sl.user_id = ? LIMIT 1) AS my_reaction,

        NULL AS reactor_name,
        NULL AS reactions_preview,
        NULL AS reactions_by_type,

        NULL AS video_url,
        NULL AS caption,
        NULL AS song_name,
        s.audio_url AS audio_url,
        0 AS audio_start,
        0 AS audio_end,
        NULL AS location,
        NULL AS sound_key,
        NULL AS sound_id,

        s.title AS song_title,
        s.artist_name AS song_artist_name,
        s.album_name AS song_album_name,
        s.cover_image_url AS song_cover_image_url,
        s.duration_seconds AS song_duration_seconds,
        s.genre AS song_genre,

        (SELECT COUNT(*) FROM song_likes sl2 WHERE sl2.song_id = s.id) AS song_likes_count,
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
        NULL AS meta,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image
      FROM songs s
      LEFT JOIN users u ON u.id = s.uploader_id
      WHERE s.uploader_id = ?
      ORDER BY s.created_at DESC
      LIMIT ?
    `;

    // PODCASTS
    const qPodcasts = `
      SELECT
        'podcast' AS source,
        'podcast' AS item_type,
        pc.id AS id,
        ('podcast:' || CAST(pc.id AS TEXT)) AS feed_key,
        pc.created_at AS created_at,

        NULL AS post_id,
        NULL AS reel_id,
        NULL AS song_id2,
        pc.id AS podcast_id,
        NULL AS event_id,
        NULL AS group_post_id,
        NULL AS product_id2,

        pc.creator_id AS user_id,
        COALESCE(u.username,'user') AS username,
        COALESCE(u.name, u.username,'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified,0) AS is_verified,
        COALESCE(u.role,'user') AS role,

        COALESCE(pc.title,'Podcast') AS content,

        'public' AS visibility,
        0 AS views,
        0 AS shares,

        pc.audio_url AS media_url,
        'audio/mpeg' AS media_type,

        CASE
          WHEN pc.cover_url IS NOT NULL AND pc.cover_url != ''
          THEN json_array(pc.cover_url)
          ELSE NULL
        END AS media_urls,

        CASE
          WHEN pc.cover_url IS NOT NULL AND pc.cover_url != ''
          THEN json_array('image')
          ELSE NULL
        END AS media_types,

        0 AS comments_count,

        0 AS reactions_count,
        NULL AS my_reaction,

        NULL AS reactor_name,
        NULL AS reactions_preview,
        NULL AS reactions_by_type,

        NULL AS video_url,
        NULL AS caption,
        NULL AS song_name,
        pc.audio_url AS audio_url,
        0 AS audio_start,
        0 AS audio_end,
        NULL AS location,
        NULL AS sound_key,
        NULL AS sound_id,

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
        NULL AS meta,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image
      FROM podcasts pc
      LEFT JOIN users u ON u.id = pc.creator_id
      WHERE pc.creator_id = ?
      ORDER BY pc.created_at DESC
      LIMIT ?
    `;

    // EVENTS
    const qEvents = `
      SELECT
        'event' AS source,
        'event' AS item_type,
        e.id AS id,
        ('event:' || CAST(e.id AS TEXT)) AS feed_key,
        e.created_at AS created_at,

        NULL AS post_id,
        NULL AS reel_id,
        NULL AS song_id2,
        NULL AS podcast_id,
        e.id AS event_id,
        NULL AS group_post_id,
        NULL AS product_id2,

        e.creator_id AS user_id,
        COALESCE(u.username,'user') AS username,
        COALESCE(u.name, u.username,'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified,0) AS is_verified,
        COALESCE(u.role,'user') AS role,

        e.title AS content,
        'public' AS visibility,
        0 AS views,
        0 AS shares,

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

        0 AS comments_count,

        0 AS reactions_count,
        NULL AS my_reaction,
        NULL AS reactor_name,
        NULL AS reactions_preview,
        NULL AS reactions_by_type,

        NULL AS video_url,
        NULL AS caption,
        NULL AS song_name,
        NULL AS audio_url,
        0 AS audio_start,
        0 AS audio_end,
        e.location AS location,
        NULL AS sound_key,
        NULL AS sound_id,

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

        e.event_date AS event_date,
        e.description AS event_description,

        (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id) AS attending_count,
        (SELECT COUNT(*) FROM event_interested ei WHERE ei.event_id = e.id) AS interested_count,

        CASE
          WHEN EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = e.id AND ea.user_id = ?) THEN 'going'
          WHEN EXISTS (SELECT 1 FROM event_interested ei WHERE ei.event_id = e.id AND ei.user_id = ?) THEN 'interested'
          ELSE ''
        END AS my_rsvp_status,

        NULL AS type,
        NULL AS post_type,
        NULL AS kind,
        NULL AS meta,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image
      FROM events e
      LEFT JOIN users u ON u.id = e.creator_id
      WHERE e.creator_id = ?
      ORDER BY e.created_at DESC
      LIMIT ?
    `;

    // PRODUCTS (feed injection)
    const qProductsFeed = `
      SELECT
        'product' AS source,
        'product' AS item_type,
        pr.id AS id,
        ('product:' || CAST(pr.id AS TEXT)) AS feed_key,
        pr.created_at AS created_at,

        NULL AS post_id,
        NULL AS reel_id,
        NULL AS song_id2,
        NULL AS podcast_id,
        NULL AS event_id,
        NULL AS group_post_id,
        pr.id AS product_id2,

        pr.seller_id AS user_id,
        COALESCE(u.username,'seller') AS username,
        COALESCE(u.name, u.username,'Seller') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified,0) AS is_verified,
        COALESCE(u.role,'user') AS role,

        pr.title AS content,
        'public' AS visibility,
        0 AS views,
        0 AS shares,

        NULL AS media_url,
        NULL AS media_type,

        pr.images AS media_urls,
        NULL AS media_types,

        0 AS comments_count,

        0 AS reactions_count,
        NULL AS my_reaction,

        NULL AS reactor_name,
        NULL AS reactions_preview,
        NULL AS reactions_by_type,

        NULL AS video_url,
        NULL AS caption,
        NULL AS song_name,
        NULL AS audio_url,
        0 AS audio_start,
        0 AS audio_end,
        NULL AS location,
        NULL AS sound_key,
        NULL AS sound_id,

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
        NULL AS group_name,
        NULL AS group_image
      FROM products pr
      LEFT JOIN users u ON u.id = pr.seller_id
      WHERE pr.seller_id = ?
      ORDER BY pr.created_at DESC
      LIMIT ?
    `;

    const [postsRes, reelsRes, songsRes, podcastsRes, eventsRes, productsFeedRes] =
      await Promise.all([
        env.DB.prepare(qPosts).bind(reactionUserId, userId, perType).all(),
        env.DB.prepare(qReels).bind(reactionUserId, userId, perType).all(),
        env.DB.prepare(qSongs).bind(reactionUserId, userId, perType).all(),
        env.DB.prepare(qPodcasts).bind(userId, perType).all(),
        env.DB.prepare(qEvents).bind(reactionUserId, reactionUserId, userId, perType).all(),
        env.DB.prepare(qProductsFeed).bind(userId, perType).all(),
      ]);

    const items = [
      ...(Array.isArray(postsRes.results) ? postsRes.results : []),
      ...(Array.isArray(reelsRes.results) ? reelsRes.results : []),
      ...(Array.isArray(songsRes.results) ? songsRes.results : []),
      ...(Array.isArray(podcastsRes.results) ? podcastsRes.results : []),
      ...(Array.isArray(eventsRes.results) ? eventsRes.results : []),
      ...(Array.isArray(productsFeedRes.results) ? productsFeedRes.results : []),
    ];

    const map = new Map<string, any>();
    for (const it of items) {
      const k = safeStr(it?.feed_key) || `${safeStr(it?.source)}:${Number(it?.id)}`;
      if (!map.has(k)) map.set(k, it);
    }

    const mergedRaw = Array.from(map.values()).sort(sortDescByCreatedAt).slice(0, limit);

    const feed = mergedRaw.map((it: any) => ({
      ...it,
      ...normalizeMedia(it),
      comments_count: Number(it?.comments_count ?? 0),
      reactions_count: Number(it?.reactions_count ?? 0),
      attending_count: Number(it?.attending_count ?? 0),
      interested_count: Number(it?.interested_count ?? 0),
    }));

    return json({ success: true, userId, viewerId, feed }, 200);
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
