// functions/api/feeds.ts
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
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const cleanCsv = (raw: string | null) =>
  String(raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const parseSeenIds = (raw: string | null, max = 250) => {
  if (!raw) return [];
  const ids = cleanCsv(raw)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(ids)).slice(0, max);
};

/**
 * ✅ NEW: seenKeys supports mixed-source feed keys safely
 * Format: "post:12,reel:99,group_post:5,event:7,song:2,podcast:4,product:10"
 * or actual feed_key values "post:12" etc.
 */
const parseSeenKeys = (raw: string | null, max = 500) => {
  const out = new Map<string, number[]>();
  if (!raw) return out;

  const parts = cleanCsv(raw).slice(0, max);

  for (const p of parts) {
    const s = String(p).trim();
    if (!s) continue;

    // accept either "source:id" OR "feed_key" already like "post:12"
    const idx = s.indexOf(":");
    if (idx <= 0) continue;

    const source = s.slice(0, idx).trim();
    const idStr = s.slice(idx + 1).trim();
    const id = Number(idStr);

    if (!source || !Number.isFinite(id) || id <= 0) continue;
    if (!out.has(source)) out.set(source, []);
    out.get(source)!.push(id);
  }

  // dedup + cap per source
  for (const [k, arr] of out.entries()) {
    out.set(k, Array.from(new Set(arr)).slice(0, 250));
  }

  return out;
};

const idsForSource = (seenMap: Map<string, number[]>, source: string) => {
  const arr = seenMap.get(source) || [];
  return Array.isArray(arr) ? arr : [];
};

const buildNotIn = (colSql: string, ids: number[], binds: any[]) => {
  if (!ids.length) return "";
  binds.push(...ids);
  return `${colSql} NOT IN (${ids.map(() => "?").join(",")})`;
};

// --------------------
// ✅ Multi-media helpers
// --------------------
const cleanUrl = (v: any) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s === "null" || s === "undefined") return "";
  if (s.startsWith("data:")) return ""; // block base64 in feeds
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
        return [];
      } catch {
        // fallthrough
      }
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
        return [];
      } catch {
        // fallthrough
      }
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
    media_urls: outUrls, // ✅ ALWAYS array
    media_types: outTypes, // ✅ ALWAYS array (best-effort)
    images: outUrls, // ✅ alias for your UI
  };
};

// Deterministic seeded RNG + shuffle (optional)
const mulberry32 = (seed: number) => {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seededShuffle = <T,>(arr: T[], seed: number) => {
  const a = arr.slice();
  const rnd = mulberry32(seed || 1);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * ✅ NEW: deterministic "random-ish" ordering inside SQL (replaces ORDER BY RANDOM())
 * Gives stable explore items for the same seed.
 */
const deterministicExploreOrder = (idCol: string) =>
  `ORDER BY ((${idCol} * 1103515245 + ?) % 2147483647) ASC`;

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const url = new URL(request.url);

    const userId = toInt(url.searchParams.get("userId"), 0);
    const reactionUserId = userId || 0;

    const limit = clamp(toInt(url.searchParams.get("limit"), 20), 1, 50);
    const cursor = url.searchParams.get("cursor"); // older-than created_at

    // ✅ IMPORTANT: keep this stable from frontend (seedRef.current)
    const seed = toInt(url.searchParams.get("seed"), 1);

    // ✅ NEW: shuffle can be disabled to keep feed stable when comment sheet is open
    const shuffle = url.searchParams.get("shuffle");
    const shouldShuffle = shuffle === null ? true : shuffle !== "0";

    // ✅ NEW: seenKeys preferred; seen (ids) kept for backward compatibility
    const seenKeys = parseSeenKeys(url.searchParams.get("seenKeys"), 500);
    const seenLegacy = parseSeenIds(url.searchParams.get("seen"), 250);

    const debug = url.searchParams.get("debug") === "1";

    const freshCount = Math.max(5, Math.floor(limit * 0.65));
    const exploreCount = Math.max(0, limit - freshCount);

    // ============================================================
    // 1) POSTS
    // ============================================================
    const wherePosts: string[] = [];
    const bindsPosts: any[] = [];

    wherePosts.push(
      `(p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')`
    );

    // block product posts stored inside posts.content
    wherePosts.push(`(p.content IS NULL OR (
      p.content NOT LIKE '%"post_type":"product"%'
      AND p.content NOT LIKE '%"kind":"product"%'
      AND p.content NOT LIKE '%"product_id"%'
      AND p.content NOT LIKE '%marketplace%'
    ))`);

    if (cursor && cursor.trim()) {
      wherePosts.push(`p.created_at < ?`);
      bindsPosts.push(cursor.trim());
    }

    // ✅ seenKeys source-specific (preferred)
    {
      const ids = idsForSource(seenKeys, "post");
      const clause = buildNotIn("p.id", ids, bindsPosts);
      if (clause) wherePosts.push(clause);
    }

    // ✅ backward-compat: old seen numeric list can still exclude posts
    if (seenLegacy.length > 0) {
      wherePosts.push(`p.id NOT IN (${seenLegacy.map(() => "?").join(",")})`);
      bindsPosts.push(...seenLegacy);
    }

    const wherePostsSql = wherePosts.length ? `WHERE ${wherePosts.join(" AND ")}` : "";

    const baseSelectPosts = `
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
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

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

        (
          SELECT json_group_array(
            json_object(
              'user_id', x.user_id,
              'type', x.type,
              'name', x.name,
              'profile_image_url', x.profile_image_url
            )
          )
          FROM (
            SELECT
              pr3.user_id AS user_id,
              LOWER(COALESCE(pr3.type,'like')) AS type,
              COALESCE(u3.name, u3.username, '') AS name,
              CASE
                WHEN u3.profile_image_url LIKE 'data:%' THEN NULL
                WHEN length(u3.profile_image_url) > 300 THEN NULL
                ELSE u3.profile_image_url
              END AS profile_image_url
            FROM post_reactions pr3
            LEFT JOIN users u3 ON u3.id = pr3.user_id
            WHERE pr3.post_id = p.id
            ORDER BY pr3.created_at DESC, pr3.id DESC
            LIMIT 30
          ) x
        ) AS reactions_preview,

        (
          SELECT json_group_array(
            json_object('type', t.type, 'count', t.c)
          )
          FROM (
            SELECT LOWER(COALESCE(type,'like')) AS type, COUNT(*) AS c
            FROM post_reactions
            WHERE post_id = p.id
            GROUP BY LOWER(COALESCE(type,'like'))
            ORDER BY c DESC
          ) t
        ) AS reactions_by_type,

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
    `;

    // ============================================================
    // 2) REELS
    // ============================================================
    const whereReels: string[] = [];
    const bindsReels: any[] = [];

    whereReels.push(
      `(r.visibility IS NULL OR r.visibility = 'public' OR r.visibility = '' OR r.visibility = 'Public')`
    );

    if (cursor && cursor.trim()) {
      whereReels.push(`r.created_at < ?`);
      bindsReels.push(cursor.trim());
    }

    {
      const ids = idsForSource(seenKeys, "reel");
      const clause = buildNotIn("r.id", ids, bindsReels);
      if (clause) whereReels.push(clause);
    }

    // legacy (still applies but can collide across sources, so we keep it minimal)
    if (seenLegacy.length > 0) {
      whereReels.push(`r.id NOT IN (${seenLegacy.map(() => "?").join(",")})`);
      bindsReels.push(...seenLegacy);
    }

    const whereReelsSql = whereReels.length ? `WHERE ${whereReels.join(" AND ")}` : "";

    const baseSelectReels = `
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
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

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
        COALESCE(r.audio_start, 0) AS audio_start,
        COALESCE(r.audio_end, 0) AS audio_end,
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
    `;

    // ============================================================
    // 3) SONGS
    // ============================================================
    const whereSongs: string[] = [];
    const bindsSongs: any[] = [];

    if (cursor && cursor.trim()) {
      whereSongs.push(`s.created_at < ?`);
      bindsSongs.push(cursor.trim());
    }

    {
      const ids = idsForSource(seenKeys, "song");
      const clause = buildNotIn("s.id", ids, bindsSongs);
      if (clause) whereSongs.push(clause);
    }

    if (seenLegacy.length > 0) {
      whereSongs.push(`s.id NOT IN (${seenLegacy.map(() => "?").join(",")})`);
      bindsSongs.push(...seenLegacy);
    }

    const whereSongsSql = whereSongs.length ? `WHERE ${whereSongs.join(" AND ")}` : "";

    const baseSelectSongs = `
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
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

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
        NULL AS meta,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image
      FROM songs s
      LEFT JOIN users u ON u.id = s.uploader_id
    `;

    // ============================================================
    // 4) PODCASTS
    // ============================================================
    const wherePodcasts: string[] = [];
    const bindsPodcasts: any[] = [];

    if (cursor && cursor.trim()) {
      wherePodcasts.push(`pc.created_at < ?`);
      bindsPodcasts.push(cursor.trim());
    }

    {
      const ids = idsForSource(seenKeys, "podcast");
      const clause = buildNotIn("pc.id", ids, bindsPodcasts);
      if (clause) wherePodcasts.push(clause);
    }

    if (seenLegacy.length > 0) {
      wherePodcasts.push(`pc.id NOT IN (${seenLegacy.map(() => "?").join(",")})`);
      bindsPodcasts.push(...seenLegacy);
    }

    const wherePodcastsSql = wherePodcasts.length ? `WHERE ${wherePodcasts.join(" AND ")}` : "";

    const baseSelectPodcasts = `
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
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

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
    `;

    // ============================================================
    // 5) EVENTS
    // ============================================================
    const whereEvents: string[] = [];
    const bindsEvents: any[] = [];

    whereEvents.push(`(e.visibility IS NULL OR e.visibility = 'worldwide' OR e.visibility = 'targeted')`);

    if (cursor && cursor.trim()) {
      whereEvents.push(`e.created_at < ?`);
      bindsEvents.push(cursor.trim());
    }

    {
      const ids = idsForSource(seenKeys, "event");
      const clause = buildNotIn("e.id", ids, bindsEvents);
      if (clause) whereEvents.push(clause);
    }

    if (seenLegacy.length > 0) {
      whereEvents.push(`e.id NOT IN (${seenLegacy.map(() => "?").join(",")})`);
      bindsEvents.push(...seenLegacy);
    }

    const whereEventsSql = whereEvents.length ? `WHERE ${whereEvents.join(" AND ")}` : "";

    const baseSelectEvents = `
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
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

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
    `;

    // ============================================================
    // 6) GROUP POSTS
    // ============================================================
    const whereGroupPosts: string[] = [];
    const bindsGroupPosts: any[] = [];

    whereGroupPosts.push(`(gp.visibility IS NULL OR gp.visibility = 'public')`);

    if (cursor && cursor.trim()) {
      whereGroupPosts.push(`gp.created_at < ?`);
      bindsGroupPosts.push(cursor.trim());
    }

    {
      const ids = idsForSource(seenKeys, "group_post");
      const clause = buildNotIn("gp.id", ids, bindsGroupPosts);
      if (clause) whereGroupPosts.push(clause);
    }

    if (seenLegacy.length > 0) {
      whereGroupPosts.push(`gp.id NOT IN (${seenLegacy.map(() => "?").join(",")})`);
      bindsGroupPosts.push(...seenLegacy);
    }

    const whereGroupPostsSql = whereGroupPosts.length ? `WHERE ${whereGroupPosts.join(" AND ")}` : "";

    const baseSelectGroupPosts = `
      SELECT
        'group_post' AS source,
        'group_post' AS item_type,

        gp.id AS id,
        ('group_post:' || CAST(gp.id AS TEXT)) AS feed_key,

        gp.created_at AS created_at,

        NULL AS post_id,
        NULL AS reel_id,
        NULL AS song_id2,
        NULL AS podcast_id,
        NULL AS event_id,
        gp.id AS group_post_id,
        NULL AS product_id2,

        gp.user_id AS user_id,
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

        gp.group_id AS group_id,
        COALESCE(g.name, 'Group') AS group_name,
        CASE
          WHEN g.profile_image LIKE 'data:%' THEN NULL
          WHEN length(g.profile_image) > 300 THEN NULL
          ELSE g.profile_image
        END AS group_image,

        gp.content AS content,
        gp.visibility AS visibility,
        0 AS views,
        0 AS shares,

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
          WHEN gp.media_urls LIKE 'data:%' THEN NULL
          WHEN length(gp.media_urls) > 5000 THEN NULL
          ELSE gp.media_urls
        END AS media_urls,

        NULL AS media_types,

        0 AS comments_count,

        (SELECT COUNT(*) FROM group_post_reactions gpr WHERE gpr.group_post_id = gp.id) AS reactions_count,
        (SELECT gpr.type FROM group_post_reactions gpr WHERE gpr.group_post_id = gp.id AND gpr.user_id = ? LIMIT 1) AS my_reaction,

        (
          SELECT COALESCE(u2.name, u2.username, '')
          FROM group_post_reactions gpr2
          JOIN users u2 ON u2.id = gpr2.user_id
          WHERE gpr2.group_post_id = gp.id
          ORDER BY gpr2.created_at DESC, gpr2.id DESC
          LIMIT 1
        ) AS reactor_name,

        (
          SELECT json_group_array(
            json_object(
              'user_id', x.user_id,
              'type', x.type,
              'name', x.name,
              'profile_image_url', x.profile_image_url
            )
          )
          FROM (
            SELECT
              gpr3.user_id AS user_id,
              LOWER(COALESCE(gpr3.type,'like')) AS type,
              COALESCE(u3.name, u3.username, '') AS name,
              CASE
                WHEN u3.profile_image_url LIKE 'data:%' THEN NULL
                WHEN length(u3.profile_image_url) > 300 THEN NULL
                ELSE u3.profile_image_url
              END AS profile_image_url
            FROM group_post_reactions gpr3
            LEFT JOIN users u3 ON u3.id = gpr3.user_id
            WHERE gpr3.group_post_id = gp.id
            ORDER BY gpr3.created_at DESC, gpr3.id DESC
            LIMIT 30
          ) x
        ) AS reactions_preview,

        (
          SELECT json_group_array(
            json_object('type', t.type, 'count', t.c)
          )
          FROM (
            SELECT LOWER(COALESCE(type,'like')) AS type, COUNT(*) AS c
            FROM group_post_reactions
            WHERE group_post_id = gp.id
            GROUP BY LOWER(COALESCE(type,'like'))
            ORDER BY c DESC
          ) t
        ) AS reactions_by_type,

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
        NULL AS meta
      FROM group_posts gp
      LEFT JOIN users u ON u.id = gp.user_id
      LEFT JOIN groups g ON g.id = gp.group_id
    `;

    // ============================================================
    // 7) PRODUCTS feed-injection
    // ============================================================
    const whereProductsFeed: string[] = [];
    const bindsProductsFeed: any[] = [];

    if (cursor && cursor.trim()) {
      whereProductsFeed.push(`pr.created_at < ?`);
      bindsProductsFeed.push(cursor.trim());
    }

    {
      const ids = idsForSource(seenKeys, "product");
      const clause = buildNotIn("pr.id", ids, bindsProductsFeed);
      if (clause) whereProductsFeed.push(clause);
    }

    if (seenLegacy.length > 0) {
      whereProductsFeed.push(`pr.id NOT IN (${seenLegacy.map(() => "?").join(",")})`);
      bindsProductsFeed.push(...seenLegacy);
    }

    const whereProductsFeedSql = whereProductsFeed.length ? `WHERE ${whereProductsFeed.join(" AND ")}` : "";

    const baseSelectProductsFeed = `
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
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

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
    `;

    // ============================================================
    // 8) PRODUCTS separate list (unchanged)
    // ============================================================
    const whereProducts: string[] = [];
    const bindsProducts: any[] = [];

    if (cursor && cursor.trim()) {
      whereProducts.push(`pr.created_at < ?`);
      bindsProducts.push(cursor.trim());
    }

    if (seenLegacy.length > 0) {
      whereProducts.push(`pr.id NOT IN (${seenLegacy.map(() => "?").join(",")})`);
      bindsProducts.push(...seenLegacy);
    }

    const whereProductsSql = whereProducts.length ? `WHERE ${whereProducts.join(" AND ")}` : "";

    const selectProducts = `
      SELECT
        pr.id,
        pr.seller_id,
        pr.title,
        pr.category,
        pr.description,
        pr.country,
        pr.address,
        pr.main_price,
        pr.discount_price,
        pr.quantity,
        pr.phone_number,
        pr.images,
        pr.created_at
      FROM products pr
      ${whereProductsSql}
      ORDER BY pr.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // RUN QUERIES (Fresh)
    // ============================================================
    const freshPostsRes = await env.DB.prepare(
      `${baseSelectPosts} ${wherePostsSql} ORDER BY p.created_at DESC LIMIT ?`
    )
      .bind(reactionUserId, ...bindsPosts, freshCount)
      .all();
    const freshPosts = Array.isArray(freshPostsRes?.results) ? freshPostsRes.results : [];

    const freshReelsRes = await env.DB.prepare(
      `${baseSelectReels} ${whereReelsSql} ORDER BY r.created_at DESC LIMIT ?`
    )
      .bind(reactionUserId, ...bindsReels, freshCount)
      .all();
    const freshReels = Array.isArray(freshReelsRes?.results) ? freshReelsRes.results : [];

    const freshSongsRes = await env.DB.prepare(
      `${baseSelectSongs} ${whereSongsSql} ORDER BY s.created_at DESC LIMIT ?`
    )
      .bind(reactionUserId, ...bindsSongs, freshCount)
      .all();
    const freshSongs = Array.isArray(freshSongsRes?.results) ? freshSongsRes.results : [];

    const freshPodcastsRes = await env.DB.prepare(
      `${baseSelectPodcasts} ${wherePodcastsSql} ORDER BY pc.created_at DESC LIMIT ?`
    )
      .bind(...bindsPodcasts, freshCount)
      .all();
    const freshPodcasts = Array.isArray(freshPodcastsRes?.results) ? freshPodcastsRes.results : [];

    const freshEventsRes = await env.DB.prepare(
      `${baseSelectEvents} ${whereEventsSql} ORDER BY e.created_at DESC LIMIT ?`
    )
      .bind(reactionUserId, reactionUserId, ...bindsEvents, freshCount)
      .all();
    const freshEvents = Array.isArray(freshEventsRes?.results) ? freshEventsRes.results : [];

    const freshGroupPostsRes = await env.DB.prepare(
      `${baseSelectGroupPosts} ${whereGroupPostsSql} ORDER BY gp.created_at DESC LIMIT ?`
    )
      .bind(reactionUserId, ...bindsGroupPosts, freshCount)
      .all();
    const freshGroupPosts = Array.isArray(freshGroupPostsRes?.results) ? freshGroupPostsRes.results : [];

    const freshProductsFeedRes = await env.DB.prepare(
      `${baseSelectProductsFeed} ${whereProductsFeedSql} ORDER BY pr.created_at DESC LIMIT ?`
    )
      .bind(...bindsProductsFeed, freshCount)
      .all();
    const freshProductsFeed = Array.isArray(freshProductsFeedRes?.results) ? freshProductsFeedRes.results : [];

    const freshProductsRes = await env.DB.prepare(selectProducts).bind(...bindsProducts, freshCount).all();
    const freshProducts = Array.isArray(freshProductsRes?.results) ? freshProductsRes.results : [];

    // ============================================================
    // RUN QUERIES (Explore) ✅ deterministic (no ORDER BY RANDOM())
    // ============================================================
    let explorePosts: any[] = [];
    let exploreReels: any[] = [];
    let exploreSongs: any[] = [];
    let explorePodcasts: any[] = [];
    let exploreEvents: any[] = [];
    let exploreGroupPosts: any[] = [];
    let exploreProductsFeed: any[] = [];
    let exploreProducts: any[] = [];

    if (exploreCount > 0) {
      const explorePostsRes = await env.DB.prepare(
        `${baseSelectPosts} ${wherePostsSql} ${deterministicExploreOrder("p.id")} LIMIT ?`
      )
        .bind(reactionUserId, ...bindsPosts, seed + 11, exploreCount)
        .all();
      explorePosts = Array.isArray(explorePostsRes?.results) ? explorePostsRes.results : [];

      const exploreReelsRes = await env.DB.prepare(
        `${baseSelectReels} ${whereReelsSql} ${deterministicExploreOrder("r.id")} LIMIT ?`
      )
        .bind(reactionUserId, ...bindsReels, seed + 22, exploreCount)
        .all();
      exploreReels = Array.isArray(exploreReelsRes?.results) ? exploreReelsRes.results : [];

      const exploreSongsRes = await env.DB.prepare(
        `${baseSelectSongs} ${whereSongsSql} ${deterministicExploreOrder("s.id")} LIMIT ?`
      )
        .bind(reactionUserId, ...bindsSongs, seed + 33, exploreCount)
        .all();
      exploreSongs = Array.isArray(exploreSongsRes?.results) ? exploreSongsRes.results : [];

      const explorePodcastsRes = await env.DB.prepare(
        `${baseSelectPodcasts} ${wherePodcastsSql} ${deterministicExploreOrder("pc.id")} LIMIT ?`
      )
        .bind(...bindsPodcasts, seed + 44, exploreCount)
        .all();
      explorePodcasts = Array.isArray(explorePodcastsRes?.results) ? explorePodcastsRes.results : [];

      const exploreEventsRes = await env.DB.prepare(
        `${baseSelectEvents} ${whereEventsSql} ${deterministicExploreOrder("e.id")} LIMIT ?`
      )
        .bind(reactionUserId, reactionUserId, ...bindsEvents, seed + 55, exploreCount)
        .all();
      exploreEvents = Array.isArray(exploreEventsRes?.results) ? exploreEventsRes.results : [];

      const exploreGroupPostsRes = await env.DB.prepare(
        `${baseSelectGroupPosts} ${whereGroupPostsSql} ${deterministicExploreOrder("gp.id")} LIMIT ?`
      )
        .bind(reactionUserId, ...bindsGroupPosts, seed + 66, exploreCount)
        .all();
      exploreGroupPosts = Array.isArray(exploreGroupPostsRes?.results) ? exploreGroupPostsRes.results : [];

      const exploreProductsFeedRes = await env.DB.prepare(
        `${baseSelectProductsFeed} ${whereProductsFeedSql} ${deterministicExploreOrder("pr.id")} LIMIT ?`
      )
        .bind(...bindsProductsFeed, seed + 77, exploreCount)
        .all();
      exploreProductsFeed = Array.isArray(exploreProductsFeedRes?.results) ? exploreProductsFeedRes.results : [];

      const exploreProductsRes = await env.DB.prepare(
        `
          SELECT
            pr.id, pr.seller_id, pr.title, pr.category, pr.description, pr.country, pr.address,
            pr.main_price, pr.discount_price, pr.quantity, pr.phone_number, pr.images, pr.created_at
          FROM products pr
          ${whereProductsSql}
          ${deterministicExploreOrder("pr.id")}
          LIMIT ?
        `
      )
        .bind(...bindsProducts, seed + 88, exploreCount)
        .all();
      exploreProducts = Array.isArray(exploreProductsRes?.results) ? exploreProductsRes.results : [];
    }

    // ============================================================
    // Merge + dedup FEED
    // ============================================================
    const map = new Map<string, any>();
    const allFeedRows = [
      ...freshPosts,
      ...freshReels,
      ...freshSongs,
      ...freshPodcasts,
      ...freshEvents,
      ...freshGroupPosts,
      ...freshProductsFeed,
      ...explorePosts,
      ...exploreReels,
      ...exploreSongs,
      ...explorePodcasts,
      ...exploreEvents,
      ...exploreGroupPosts,
      ...exploreProductsFeed,
    ];

    for (const row of allFeedRows) {
      const fk = String((row as any)?.feed_key || "");
      if (fk) {
        if (!map.has(fk)) map.set(fk, row);
        continue;
      }
      const src = String((row as any)?.source || "");
      const id = Number((row as any)?.id);
      if (!src || !Number.isFinite(id)) continue;
      const key = `${src}:${id}`;
      if (!map.has(key)) map.set(key, row);
    }

    const merged = Array.from(map.values());

    // nextCursor based on the OLDEST returned item (by created_at)
    const oldest = merged.reduce((acc: any, cur: any) => {
      if (!acc) return cur;
      return String(cur.created_at) < String(acc.created_at) ? cur : acc;
    }, null as any);

    const nextCursor = oldest?.created_at ?? null;

    // ✅ Ordering: either stable (created_at desc) or shuffled (seeded)
    const orderedRaw = shouldShuffle
      ? seededShuffle(merged, seed)
      : merged
          .slice()
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    // ✅ Normalize media for ALL feed items
    const ordered = orderedRaw.map((item: any) => ({
      ...item,
      ...normalizeMedia(item),
      comments_count: Number((item as any)?.comments_count ?? 0),
      feed_key: String((item as any)?.feed_key || `${(item as any)?.source}:${(item as any)?.id}`),
    }));

    // ============================================================
    // Merge + dedup PRODUCTS (separate list) + normalize images
    // ============================================================
    const productMap = new Map<number, any>();
    for (const row of [...freshProducts, ...exploreProducts]) {
      const id = Number((row as any)?.id);
      if (!Number.isFinite(id)) continue;
      if (!productMap.has(id)) {
        const imgs = parseJsonArrayUrls((row as any)?.images);
        productMap.set(id, {
          ...row,
          images: imgs,
          media_urls: imgs,
        });
      }
    }
    const products = Array.from(productMap.values());

    // ============================================================
    // hasMore (posts-only simple)
    // ============================================================
    let hasMore = false;
    if (nextCursor) {
      const qMore = `
        SELECT p.id
        FROM posts p
        WHERE
          (p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')
          AND (p.content IS NULL OR (
            p.content NOT LIKE '%"post_type":"product"%'
            AND p.content NOT LIKE '%"kind":"product"%'
            AND p.content NOT LIKE '%"product_id"%'
            AND p.content NOT LIKE '%marketplace%'
          ))
          AND p.created_at < ?
        ORDER BY p.created_at DESC
        LIMIT 1
      `;
      const more = await env.DB.prepare(qMore).bind(nextCursor).first();
      hasMore = !!more;
    }

    const payload = {
      success: true,
      userId,
      limit,
      cursor: cursor ?? null,
      nextCursor,
      hasMore,
      seed,
      shuffle: shouldShuffle ? 1 : 0,
      feed: ordered,
      products,
    };

    if (debug) {
      return json({
        ...payload,
        debug: {
          seenLegacyCount: seenLegacy.length,
          seenKeysSources: Array.from(seenKeys.keys()),
          returnedFeed: ordered.length,
          returnedProducts: products.length,
          fresh: {
            posts: freshPosts.length,
            reels: freshReels.length,
            songs: freshSongs.length,
            podcasts: freshPodcasts.length,
            events: freshEvents.length,
            groupPosts: freshGroupPosts.length,
            productsFeed: freshProductsFeed.length,
            products: freshProducts.length,
          },
          explore: {
            posts: explorePosts.length,
            reels: exploreReels.length,
            songs: exploreSongs.length,
            podcasts: explorePodcasts.length,
            events: exploreEvents.length,
            groupPosts: exploreGroupPosts.length,
            productsFeed: exploreProductsFeed.length,
            products: exploreProducts.length,
          },
        },
      });
    }

    return json(payload);
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
