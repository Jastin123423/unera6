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

const parseSeenIds = (raw: string | null, max = 250) => {
  if (!raw) return [];
  const ids = raw
    .split(",")
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

/**
 * ✅ Product-only changes in this file:
 * 1) userId is OPTIONAL now (so /api/feeds works in browser without ?userId=...)
 * 2) Optional injection of product cards into "feed" (without changing posts/reels/songs/podcasts SQL)
 *    - enable by adding: ?injectProducts=1
 *    - products also still returned as separate `products` list (unchanged)
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const url = new URL(request.url);

    // ✅ userId OPTIONAL (fixes {"success":false,"error":"Missing userId"} when opening /api/feeds)
    // If not provided: treat as public viewer (userId=0)
    const userId = toInt(url.searchParams.get("userId"), 0);

    const limit = clamp(toInt(url.searchParams.get("limit"), 20), 1, 50);
    const cursor = url.searchParams.get("cursor"); // older-than created_at
    const seed = toInt(url.searchParams.get("seed"), 1);
    const seen = parseSeenIds(url.searchParams.get("seen"), 250);
    const debug = url.searchParams.get("debug") === "1";

    // ✅ product-only toggle: inject product items into feed
    const injectProducts = url.searchParams.get("injectProducts") === "1";

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
      wherePosts.push(`p.id NOT IN (${seen.map(() => "?").join(",")})`);
      bindsPosts.push(...seen);
    }

    const wherePostsSql = wherePosts.length ? `WHERE ${wherePosts.join(" AND ")}` : "";

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

    if (seen.length > 0) {
      whereReels.push(`r.id NOT IN (${seen.map(() => "?").join(",")})`);
      bindsReels.push(...seen);
    }

    const whereReelsSql = whereReels.length ? `WHERE ${whereReels.join(" AND ")}` : "";

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
    // 3) SONGS
    // ============================================================
    const whereSongs: string[] = [];
    const bindsSongs: any[] = [];

    if (cursor && cursor.trim()) {
      whereSongs.push(`s.created_at < ?`);
      bindsSongs.push(cursor.trim());
    }

    if (seen.length > 0) {
      whereSongs.push(`s.id NOT IN (${seen.map(() => "?").join(",")})`);
      bindsSongs.push(...seen);
    }

    const whereSongsSql = whereSongs.length ? `WHERE ${whereSongs.join(" AND ")}` : "";

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

        (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS reactions_count,
        (SELECT 'like' FROM song_likes sl WHERE sl.song_id = s.id AND sl.user_id = ? LIMIT 1) AS my_reaction,

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

    if (seen.length > 0) {
      wherePodcasts.push(`pc.id NOT IN (${seen.map(() => "?").join(",")})`);
      bindsPodcasts.push(...seen);
    }

    const wherePodcastsSql = wherePodcasts.length ? `WHERE ${wherePodcasts.join(" AND ")}` : "";

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

        0 AS reactions_count,
        NULL AS my_reaction,

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
    // 5) PRODUCTS (separate list)
    // ============================================================
    const whereProducts: string[] = [];
    const bindsProducts: any[] = [];

    if (cursor && cursor.trim()) {
      whereProducts.push(`pr.created_at < ?`);
      bindsProducts.push(cursor.trim());
    }

    if (seen.length > 0) {
      whereProducts.push(`pr.id NOT IN (${seen.map(() => "?").join(",")})`);
      bindsProducts.push(...seen);
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
      .bind(userId, ...bindsPosts, freshCount)
      .all();
    const freshPosts = Array.isArray((freshPostsRes as any)?.results) ? (freshPostsRes as any).results : [];

    const freshReelsRes = await env.DB.prepare(
      `${baseSelectReels} ${whereReelsSql} ORDER BY r.created_at DESC LIMIT ?`
    )
      .bind(userId, ...bindsReels, freshCount)
      .all();
    const freshReels = Array.isArray((freshReelsRes as any)?.results) ? (freshReelsRes as any).results : [];

    const freshSongsRes = await env.DB.prepare(
      `${baseSelectSongs} ${whereSongsSql} ORDER BY s.created_at DESC LIMIT ?`
    )
      .bind(userId, ...bindsSongs, freshCount)
      .all();
    const freshSongs = Array.isArray((freshSongsRes as any)?.results) ? (freshSongsRes as any).results : [];

    const freshPodcastsRes = await env.DB.prepare(
      `${baseSelectPodcasts} ${wherePodcastsSql} ORDER BY pc.created_at DESC LIMIT ?`
    )
      .bind(...bindsPodcasts, freshCount)
      .all();
    const freshPodcasts = Array.isArray((freshPodcastsRes as any)?.results) ? (freshPodcastsRes as any).results : [];

    const freshProductsRes = await env.DB.prepare(selectProducts)
      .bind(...bindsProducts, freshCount)
      .all();
    const freshProducts = Array.isArray((freshProductsRes as any)?.results) ? (freshProductsRes as any).results : [];

    // ============================================================
    // RUN QUERIES (Explore)
    // ============================================================
    let explorePosts: any[] = [];
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
      explorePosts = Array.isArray((explorePostsRes as any)?.results) ? (explorePostsRes as any).results : [];

      const exploreReelsRes = await env.DB.prepare(
        `${baseSelectReels} ${whereReelsSql} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(userId, ...bindsReels, exploreCount)
        .all();
      exploreReels = Array.isArray((exploreReelsRes as any)?.results) ? (exploreReelsRes as any).results : [];

      const exploreSongsRes = await env.DB.prepare(
        `${baseSelectSongs} ${whereSongsSql} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(userId, ...bindsSongs, exploreCount)
        .all();
      exploreSongs = Array.isArray((exploreSongsRes as any)?.results) ? (exploreSongsRes as any).results : [];

      const explorePodcastsRes = await env.DB.prepare(
        `${baseSelectPodcasts} ${wherePodcastsSql} ORDER BY RANDOM() LIMIT ?`
      )
        .bind(...bindsPodcasts, exploreCount)
        .all();
      explorePodcasts = Array.isArray((explorePodcastsRes as any)?.results) ? (explorePodcastsRes as any).results : [];

      const exploreProductsRes = await env.DB.prepare(
        `
          SELECT
            pr.id, pr.seller_id, pr.title, pr.category, pr.description, pr.country, pr.address,
            pr.main_price, pr.discount_price, pr.quantity, pr.phone_number, pr.images, pr.created_at
          FROM products pr
          ${whereProductsSql}
          ORDER BY RANDOM()
          LIMIT ?
        `
      )
        .bind(...bindsProducts, exploreCount)
        .all();
      exploreProducts = Array.isArray((exploreProductsRes as any)?.results) ? (exploreProductsRes as any).results : [];
    }

    // ============================================================
    // Merge + dedup FEED (posts/reels/songs/podcasts unchanged)
    // ============================================================
    const map = new Map<string, any>();
    const allFeedRows = [
      ...freshPosts,
      ...freshReels,
      ...freshSongs,
      ...freshPodcasts,
      ...explorePosts,
      ...exploreReels,
      ...exploreSongs,
      ...explorePodcasts,
    ];

    for (const row of allFeedRows) {
      const src = String((row as any)?.source || "");
      const id = Number((row as any)?.id);
      if (!src || !Number.isFinite(id)) continue;
      const key = `${src}:${id}`;
      if (!map.has(key)) map.set(key, row);
    }

    let merged = Array.from(map.values());

    // ============================================================
    // Merge + dedup PRODUCTS (separate list - unchanged)
    // ============================================================
    const productMap = new Map<number, any>();
    for (const row of [...freshProducts, ...exploreProducts]) {
      const id = Number((row as any)?.id);
      if (!Number.isFinite(id)) continue;
      if (!productMap.has(id)) productMap.set(id, row);
    }
    const products = Array.from(productMap.values());

    // ============================================================
    // ✅ PRODUCT-ONLY ADD: Optional injection into feed
    // This does NOT touch posts/reels/songs/podcasts
    // It creates "feed items" that look like posts with product_id/meta
    // ============================================================
    if (injectProducts && products.length > 0) {
      const productItems = products.slice(0, Math.min(products.length, Math.max(3, Math.floor(limit * 0.35)))).map((p: any) => {
        const pid = Number(p.id);
        const imagesRaw = p.images;

        // try to normalize images -> JSON string array
        let imagesArr: string[] = [];
        if (Array.isArray(imagesRaw)) {
          imagesArr = imagesRaw.filter(Boolean).map(String);
        } else if (typeof imagesRaw === "string" && imagesRaw.trim()) {
          // could already be JSON or comma-separated
          const t = imagesRaw.trim();
          if (t.startsWith("[") && t.endsWith("]")) {
            try {
              const parsed = JSON.parse(t);
              if (Array.isArray(parsed)) imagesArr = parsed.filter(Boolean).map(String);
            } catch {
              imagesArr = t.split(",").map((x) => x.trim()).filter(Boolean);
            }
          } else {
            imagesArr = t.split(",").map((x) => x.trim()).filter(Boolean);
          }
        }

        return {
          source: "product",
          item_type: "marketplace", // your Feed.tsx can key on this
          id: pid,                  // unique
          created_at: p.created_at,

          // minimal user-like fields (seller)
          user_id: Number(p.seller_id) || 0,
          username: "Marketplace",
          name: "Marketplace",
          profile_image_url: null,
          is_verified: 0,
          role: "user",

          // post-like fields
          content: String(p.title || ""),
          visibility: "public",
          views: 0,
          shares: 0,

          // media
          media_url: imagesArr[0] || null,
          media_type: imagesArr[0] ? "image" : null,
          media_urls: imagesArr.length ? JSON.stringify(imagesArr) : null,
          media_types: imagesArr.length ? JSON.stringify(imagesArr.map(() => "image")) : null,

          reactions_count: 0,
          my_reaction: null,

          // keep other columns compatible
          video_url: null,
          caption: null,
          song_name: null,
          audio_url: null,
          audio_start: 0,
          audio_end: 0,
          location: null,
          song_id: null,
          sound_key: null,
          sound_id: null,

          song_title: null,
          song_artist_name: null,
          song_album_name: null,
          song_cover_image_url: null,
          song_duration_seconds: null,
          song_genre: null,
          song_likes_count: null,
          song_plays_count: null,

          podcast_title: null,
          podcast_description: null,
          podcast_audio_url: null,
          podcast_cover_url: null,
          podcast_plays_count: null,

          // ✅ product fields your button likely needs:
          type: "marketplace",
          product_id: pid,
          meta: {
            kind: "product",
            product_id: pid,
            marketplace: { id: pid },
          },

          // optional: include the product itself so UI can open details instantly
          product: p,
        };
      });

      // merge product items into feed map safely
      for (const row of productItems) {
        const key = `product:${row.id}`;
        if (!map.has(key)) map.set(key, row);
      }
      merged = Array.from(map.values());
    }

    // cursor based on merged (safe)
    const oldest = merged.reduce((acc: any, cur: any) => {
      if (!acc) return cur;
      return String(cur.created_at) < String(acc.created_at) ? cur : acc;
    }, null as any);

    const nextCursor = oldest?.created_at ?? null;
    const ordered = seededShuffle(merged, seed);

    // ============================================================
    // hasMore (posts-only simple - unchanged)
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
      products, // ✅ still returned separately (your widget can use this)
    };

    if (debug) {
      return json({
        ...payload,
        debug: {
          injectProducts,
          seenCount: seen.length,
          returnedFeed: ordered.length,
          returnedProducts: products.length,
          fresh: {
            posts: freshPosts.length,
            reels: freshReels.length,
            songs: freshSongs.length,
            podcasts: freshPodcasts.length,
            products: freshProducts.length,
          },
          explore: {
            posts: explorePosts.length,
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
