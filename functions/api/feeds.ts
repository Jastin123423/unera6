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

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const parseSeenIds = (raw: string | null, max = 250) => {
  if (!raw) return [];
  const ids = raw
    .split(',')
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(ids)).slice(0, max);
};

// Deterministic seeded RNG + shuffle
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

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'DB binding missing (DB)' }, 500);

    const url = new URL(request.url);

    const userId = toInt(url.searchParams.get('userId'), 0);
    if (!userId) return json({ success: false, error: 'Missing userId' }, 400);

    const limit = clamp(toInt(url.searchParams.get('limit'), 20), 1, 50);
    const cursor = url.searchParams.get('cursor'); // older-than created_at
    const seed = toInt(url.searchParams.get('seed'), 1);
    const seen = parseSeenIds(url.searchParams.get('seen'), 250);
    const debug = url.searchParams.get('debug') === '1';

    // optional: include only one group if provided
    const groupId = toInt(url.searchParams.get('groupId'), 0);

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

    if (cursor && cursor.trim()) {
      wherePosts.push(`p.created_at < ?`);
      bindsPosts.push(cursor.trim());
    }

    if (seen.length > 0) {
      wherePosts.push(`p.id NOT IN (${seen.map(() => '?').join(',')})`);
      bindsPosts.push(...seen);
    }

    const wherePostsSql = wherePosts.length ? `WHERE ${wherePosts.join(' AND ')}` : '';

    // NOTE: has "my_reaction" -> bind userId FIRST whenever executing this SELECT
    const baseSelectPosts = `
      SELECT
        'post' AS source,
        'post' AS item_type,
        p.id AS id,
        p.created_at AS created_at,

        p.user_id AS user_id,
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.username, 'User') AS name,
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

        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,
        (SELECT pr.type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = ? LIMIT 1) AS my_reaction,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_privacy,

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
    `;

    // ============================================================
    // 2) GROUP POSTS (public groups visible to everyone; private only to members)
    // Requires: groups.privacy ('public'|'private') default 'public'
    // ============================================================
    const whereGroups: string[] = [];
    const bindsGroups: any[] = [];

    if (cursor && cursor.trim()) {
      whereGroups.push(`gp.created_at < ?`);
      bindsGroups.push(cursor.trim());
    }

    if (seen.length > 0) {
      whereGroups.push(`gp.id NOT IN (${seen.map(() => '?').join(',')})`);
      bindsGroups.push(...seen);
    }

    if (groupId > 0) {
      whereGroups.push(`gp.group_id = ?`);
      bindsGroups.push(groupId);
    }

    whereGroups.push(`
      (
        COALESCE(g.privacy, 'public') = 'public'
        OR (
          COALESCE(g.privacy, 'public') = 'private'
          AND EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = gp.group_id AND gm.user_id = ?
          )
        )
      )
    `);
    bindsGroups.push(userId);

    const whereGroupsSql = whereGroups.length ? `WHERE ${whereGroups.join(' AND ')}` : '';

    const baseSelectGroupPosts = `
      SELECT
        'group' AS source,
        'group_post' AS item_type,
        gp.id AS id,
        gp.created_at AS created_at,

        gp.user_id AS user_id,
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

        gp.content AS content,
        'Group' AS visibility,
        0 AS views,
        0 AS shares,

        CASE
          WHEN gp.media_url LIKE 'data:%' THEN NULL
          WHEN length(gp.media_url) > 300 THEN NULL
          ELSE gp.media_url
        END AS media_url,

        NULL AS media_type,
        NULL AS media_urls,
        NULL AS media_types,

        0 AS reactions_count,
        NULL AS my_reaction,

        gp.group_id AS group_id,
        COALESCE(g.name, 'Group') AS group_name,
        COALESCE(g.privacy, 'public') AS group_privacy,

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
      FROM group_posts gp
      JOIN groups g ON g.id = gp.group_id
      LEFT JOIN users u ON u.id = gp.user_id
    `;

    // ============================================================
    // 3) REELS
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

    if (seen.length > 0) {
      whereReels.push(`r.id NOT IN (${seen.map(() => '?').join(',')})`);
      bindsReels.push(...seen);
    }

    const whereReelsSql = whereReels.length ? `WHERE ${whereReels.join(' AND ')}` : '';

    // NOTE: has "my_reaction" -> bind userId FIRST whenever executing this SELECT
    const baseSelectReels = `
      SELECT
        'reel' AS source,
        'reel' AS item_type,
        r.id AS id,
        r.created_at AS created_at,

        r.user_id AS user_id,
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.username, 'User') AS name,
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

        (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.id) AS reactions_count,
        (SELECT rl.type FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = ? LIMIT 1) AS my_reaction,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_privacy,

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
    `;

    // ============================================================
    // 4) SONGS (KEEP FRONTEND SAME, but counts computed from tables)
    // Tables used:
    // - song_likes (likes)
    // - song_play_events + song_plays (plays)  ✅ we sum both so either logging works
    // ============================================================
    const whereSongs: string[] = [];
    const bindsSongs: any[] = [];

    if (cursor && cursor.trim()) {
      whereSongs.push(`s.created_at < ?`);
      bindsSongs.push(cursor.trim());
    }

    if (seen.length > 0) {
      whereSongs.push(`s.id NOT IN (${seen.map(() => '?').join(',')})`);
      bindsSongs.push(...seen);
    }

    const whereSongsSql = whereSongs.length ? `WHERE ${whereSongs.join(' AND ')}` : '';

    // NOTE: has "my_reaction" -> bind userId FIRST whenever executing this SELECT
    // my_reaction returns 'like' if liked else NULL (string, so frontend stays stable)
    const baseSelectSongs = `
      SELECT
        'song' AS source,
        'song' AS item_type,
        s.id AS id,
        s.created_at AS created_at,

        s.uploader_id AS user_id,
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

        NULL AS content,
        'public' AS visibility,
        0 AS views,
        0 AS shares,

        s.cover_image_url AS media_url,
        'image' AS media_type,
        NULL AS media_urls,
        NULL AS media_types,

        /* ✅ likes count from table */
        (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS reactions_count,

        /* ✅ keep frontend: my_reaction string or null */
        (SELECT 'like' FROM song_likes sl WHERE sl.song_id = s.id AND sl.user_id = ? LIMIT 1) AS my_reaction,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_privacy,

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

        /* ✅ likes_count computed */
        (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS song_likes_count,

        /* ✅ plays_count computed from BOTH tables you created */
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
    `;

    // ============================================================
    // 5) PODCASTS
    // ============================================================
    const wherePodcasts: string[] = [];
    const bindsPodcasts: any[] = [];

    if (cursor && cursor.trim()) {
      wherePodcasts.push(`pc.created_at < ?`);
      bindsPodcasts.push(cursor.trim());
    }

    if (seen.length > 0) {
      wherePodcasts.push(`pc.id NOT IN (${seen.map(() => '?').join(',')})`);
      bindsPodcasts.push(...seen);
    }

    const wherePodcastsSql = wherePodcasts.length ? `WHERE ${wherePodcasts.join(' AND ')}` : '';

    const baseSelectPodcasts = `
      SELECT
        'podcast' AS source,
        'podcast' AS item_type,
        pc.id AS id,
        pc.created_at AS created_at,

        pc.creator_id AS user_id,
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

        NULL AS content,
        'public' AS visibility,
        0 AS views,
        0 AS shares,

        pc.cover_url AS media_url,
        'image' AS media_type,
        NULL AS media_urls,
        NULL AS media_types,

        0 AS reactions_count,
        NULL AS my_reaction,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_privacy,

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
    `;

    // ============================================================
    // 6) PRODUCTS
    // ============================================================
    const whereProducts: string[] = [];
    const bindsProducts: any[] = [];

    if (cursor && cursor.trim()) {
      whereProducts.push(`pr.created_at < ?`);
      bindsProducts.push(cursor.trim());
    }

    if (seen.length > 0) {
      whereProducts.push(`pr.id NOT IN (${seen.map(() => '?').join(',')})`);
      bindsProducts.push(...seen);
    }

    const whereProductsSql = whereProducts.length ? `WHERE ${whereProducts.join(' AND ')}` : '';

    const baseSelectProducts = `
      SELECT
        'product' AS source,
        'product' AS item_type,
        pr.id AS id,
        pr.created_at AS created_at,

        pr.seller_id AS user_id,
        COALESCE(u.username, 'seller') AS username,
        COALESCE(u.username, 'Seller') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

        NULL AS content,
        'public' AS visibility,
        0 AS views,
        0 AS shares,

        NULL AS media_url,
        NULL AS media_type,
        pr.images AS media_urls,
        NULL AS media_types,

        0 AS reactions_count,
        NULL AS my_reaction,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_privacy,

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
    `;

    // ============================================================
    // RUN QUERIES (Fresh)
    // ============================================================
    const freshPostsRes = await env.DB.prepare(
      `${baseSelectPosts} ${wherePostsSql} ORDER BY p.created_at DESC LIMIT ?`
    )
      .bind(userId, ...bindsPosts, freshCount)
      .all();
    const freshPosts = Array.isArray(freshPostsRes?.results) ? freshPostsRes.results : [];

    const freshGroupsRes = await env.DB.prepare(
      `${baseSelectGroupPosts} ${whereGroupsSql} ORDER BY gp.created_at DESC LIMIT ?`
    )
      .bind(...bindsGroups, freshCount)
      .all();
    const freshGroups = Array.isArray(freshGroupsRes?.results) ? freshGroupsRes.results : [];

    const freshReelsRes = await env.DB.prepare(
      `${baseSelectReels} ${whereReelsSql} ORDER BY r.created_at DESC LIMIT ?`
    )
      .bind(userId, ...bindsReels, freshCount)
      .all();
    const freshReels = Array.isArray(freshReelsRes?.results) ? freshReelsRes.results : [];

    const freshSongsRes = await env.DB.prepare(
      `${baseSelectSongs} ${whereSongsSql} ORDER BY s.created_at DESC LIMIT ?`
    )
      .bind(userId, ...bindsSongs, freshCount)
      .all();
    const freshSongs = Array.isArray(freshSongsRes?.results) ? freshSongsRes.results : [];

    const freshPodcastsRes = await env.DB.prepare(
      `${baseSelectPodcasts} ${wherePodcastsSql} ORDER BY pc.created_at DESC LIMIT ?`
    )
      .bind(...bindsPodcasts, freshCount)
      .all();
    const freshPodcasts = Array.isArray(freshPodcastsRes?.results) ? freshPodcastsRes.results : [];

    const freshProductsRes = await env.DB.prepare(
      `${baseSelectProducts} ${whereProductsSql} ORDER BY pr.created_at DESC LIMIT ?`
    )
      .bind(...bindsProducts, freshCount)
      .all();
    const freshProducts = Array.isArray(freshProductsRes?.results) ? freshProductsRes.results : [];

    // ============================================================
    // RUN QUERIES (Explore)
    // ============================================================
    let explorePosts: any[] = [];
    let exploreGroups: any[] = [];
    let exploreReels: any[] = [];
    let exploreSongs: any[] = [];
    let explorePodcasts: any[] = [];
    let exploreProducts: any[] = [];

    if (exploreCount > 0) {
      const explorePostsRes = await env.DB.prepare(
        `${baseSelectPosts} ${wherePostsSql} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(userId, ...bindsPosts, exploreCount)
        .all();
      explorePosts = Array.isArray(explorePostsRes?.results) ? explorePostsRes.results : [];

      const exploreGroupsRes = await env.DB.prepare(
        `${baseSelectGroupPosts} ${whereGroupsSql} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(...bindsGroups, exploreCount)
        .all();
      exploreGroups = Array.isArray(exploreGroupsRes?.results) ? exploreGroupsRes.results : [];

      const exploreReelsRes = await env.DB.prepare(
        `${baseSelectReels} ${whereReelsSql} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(userId, ...bindsReels, exploreCount)
        .all();
      exploreReels = Array.isArray(exploreReelsRes?.results) ? exploreReelsRes.results : [];

      const exploreSongsRes = await env.DB.prepare(
        `${baseSelectSongs} ${whereSongsSql} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(userId, ...bindsSongs, exploreCount)
        .all();
      exploreSongs = Array.isArray(exploreSongsRes?.results) ? exploreSongsRes.results : [];

      const explorePodcastsRes = await env.DB.prepare(
        `${baseSelectPodcasts} ${wherePodcastsSql} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(...bindsPodcasts, exploreCount)
        .all();
      explorePodcasts = Array.isArray(explorePodcastsRes?.results) ? explorePodcastsRes.results : [];

      const exploreProductsRes = await env.DB.prepare(
        `${baseSelectProducts} ${whereProductsSql} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(...bindsProducts, exploreCount)
        .all();
      exploreProducts = Array.isArray(exploreProductsRes?.results) ? exploreProductsRes.results : [];
    }

    // ============================================================
    // Merge + dedup
    // ============================================================
    const map = new Map<string, any>();
    const allRows = [
      ...freshPosts,
      ...freshGroups,
      ...freshReels,
      ...freshSongs,
      ...freshPodcasts,
      ...freshProducts,
      ...explorePosts,
      ...exploreGroups,
      ...exploreReels,
      ...exploreSongs,
      ...explorePodcasts,
      ...exploreProducts,
    ];

    for (const row of allRows) {
      const src = String((row as any)?.source || '');
      const id = Number((row as any)?.id);
      if (!src || !Number.isFinite(id)) continue;

      const key = `${src}:${id}`;
      if (!map.has(key)) map.set(key, row);
    }

    const merged = Array.from(map.values());

    // nextCursor = oldest created_at among returned
    const oldest = merged.reduce((acc: any, cur: any) => {
      if (!acc) return cur;
      return String(cur.created_at) < String(acc.created_at) ? cur : acc;
    }, null as any);

    const nextCursor = oldest?.created_at ?? null;

    // Shuffle for variety
    const ordered = seededShuffle(merged, seed);

    // ============================================================
    // hasMore (kept simple to avoid frontend changes)
    // NOTE: this checks posts only. If you want "perfect hasMore across all types",
    // tell me and I’ll upgrade it without changing frontend.
    // ============================================================
    let hasMore = false;
    if (nextCursor) {
      const qMore = `
        SELECT p.id
        FROM posts p
        WHERE
          (p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')
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
      feed: ordered,
    };

    if (debug) {
      return json({
        ...payload,
        debug: {
          groupId: groupId || null,
          seenCount: seen.length,
          returned: ordered.length,
          fresh: {
            posts: freshPosts.length,
            groups: freshGroups.length,
            reels: freshReels.length,
            songs: freshSongs.length,
            podcasts: freshPodcasts.length,
            products: freshProducts.length,
          },
          explore: {
            posts: explorePosts.length,
            groups: exploreGroups.length,
            reels: exploreReels.length,
            songs: exploreSongs.length,
            podcasts: explorePodcasts.length,
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
