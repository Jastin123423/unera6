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
    media_urls: outUrls,
    media_types: outTypes,
    images: outUrls,
  };
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
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const url = new URL(request.url);

    const userId = toInt(url.searchParams.get("userId"), 0);
    const reactionUserId = userId || 0;

    const limit = clamp(toInt(url.searchParams.get("limit"), 20), 1, 50);
    const cursor = url.searchParams.get("cursor");
    const seed = toInt(url.searchParams.get("seed"), 1);
    const seen = parseSeenIds(url.searchParams.get("seen"), 250);
    const debug = url.searchParams.get("debug") === "1";

    const freshCount = Math.max(5, Math.floor(limit * 0.65));
    const exploreCount = Math.max(0, limit - freshCount);

    // ============================================================
    // 1) POSTS - SIMPLE SHAPE
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

    const selectPosts = `
      SELECT
        p.id,
        p.user_id,
        p.content,
        p.visibility,
        p.views,
        p.shares,
        p.media_url,
        p.media_type,
        p.media_urls,
        p.media_types,
        p.created_at,
        
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role,
        
        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,
        (SELECT pr.type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = ? LIMIT 1) AS my_reaction,
        
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
              pr3.user_id,
              LOWER(COALESCE(pr3.type,'like')) AS type,
              COALESCE(u3.name, u3.username, '') AS name,
              u3.profile_image_url
            FROM post_reactions pr3
            LEFT JOIN users u3 ON u3.id = pr3.user_id
            WHERE pr3.post_id = p.id
            ORDER BY pr3.created_at DESC, pr3.id DESC
            LIMIT 30
          ) x
        ) AS reactions_preview
        
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      ${wherePostsSql}
      ORDER BY p.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // 2) REELS - SIMPLE SHAPE
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

    const selectReels = `
      SELECT
        r.id,
        r.user_id,
        r.caption AS content,
        r.visibility,
        r.views,
        r.shares,
        r.video_url AS media_url,
        'video' AS media_type,
        NULL AS media_urls,
        NULL AS media_types,
        r.created_at,
        
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role,
        
        (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.id) AS reactions_count,
        (SELECT rl.type FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = ? LIMIT 1) AS my_reaction,
        0 AS comments_count,
        NULL AS reactions_preview
        
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      ${whereReelsSql}
      ORDER BY r.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // 3) SONGS - SIMPLE SHAPE
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

    const selectSongs = `
      SELECT
        s.id,
        s.uploader_id AS user_id,
        COALESCE(s.title,'') || ' — ' || COALESCE(s.artist_name,'') AS content,
        'public' AS visibility,
        0 AS views,
        0 AS shares,
        s.audio_url AS media_url,
        'audio/mpeg' AS media_type,
        CASE WHEN s.cover_image_url IS NOT NULL THEN json_array(s.cover_image_url) ELSE NULL END AS media_urls,
        CASE WHEN s.cover_image_url IS NOT NULL THEN json_array('image') ELSE NULL END AS media_types,
        s.created_at,
        
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role,
        
        (SELECT COUNT(*) FROM song_likes sl WHERE sl.song_id = s.id) AS reactions_count,
        (SELECT 'like' FROM song_likes sl WHERE sl.song_id = s.id AND sl.user_id = ? LIMIT 1) AS my_reaction,
        0 AS comments_count,
        NULL AS reactions_preview
        
      FROM songs s
      LEFT JOIN users u ON u.id = s.uploader_id
      ${whereSongsSql}
      ORDER BY s.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // 4) PODCASTS - SIMPLE SHAPE
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

    const selectPodcasts = `
      SELECT
        pc.id,
        pc.creator_id AS user_id,
        pc.title AS content,
        'public' AS visibility,
        0 AS views,
        0 AS shares,
        pc.audio_url AS media_url,
        'audio/mpeg' AS media_type,
        CASE WHEN pc.cover_url IS NOT NULL THEN json_array(pc.cover_url) ELSE NULL END AS media_urls,
        CASE WHEN pc.cover_url IS NOT NULL THEN json_array('image') ELSE NULL END AS media_types,
        pc.created_at,
        
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role,
        
        0 AS reactions_count,
        NULL AS my_reaction,
        0 AS comments_count,
        NULL AS reactions_preview
        
      FROM podcasts pc
      LEFT JOIN users u ON u.id = pc.creator_id
      ${wherePodcastsSql}
      ORDER BY pc.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // 5) EVENTS - SIMPLE SHAPE
    // ============================================================
    const whereEvents: string[] = [];
    const bindsEvents: any[] = [];

    whereEvents.push(`(e.visibility IS NULL OR e.visibility = 'worldwide' OR e.visibility = 'targeted')`);

    if (cursor && cursor.trim()) {
      whereEvents.push(`e.created_at < ?`);
      bindsEvents.push(cursor.trim());
    }
    if (seen.length > 0) {
      whereEvents.push(`e.id NOT IN (${seen.map(() => "?").join(",")})`);
      bindsEvents.push(...seen);
    }

    const whereEventsSql = whereEvents.length ? `WHERE ${whereEvents.join(" AND ")}` : "";

    const selectEvents = `
      SELECT
        e.id,
        e.creator_id AS user_id,
        e.title AS content,
        'public' AS visibility,
        0 AS views,
        0 AS shares,
        e.cover_url AS media_url,
        'image' AS media_type,
        CASE WHEN e.cover_url IS NOT NULL THEN json_array(e.cover_url) ELSE NULL END AS media_urls,
        CASE WHEN e.cover_url IS NOT NULL THEN json_array('image') ELSE NULL END AS media_types,
        e.created_at,
        
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role,
        
        0 AS reactions_count,
        NULL AS my_reaction,
        0 AS comments_count,
        NULL AS reactions_preview,
        
        e.event_date,
        e.description AS event_description,
        e.location,
        (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id) AS attending_count,
        (SELECT COUNT(*) FROM event_interested ei WHERE ei.event_id = e.id) AS interested_count,
        CASE
          WHEN EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = e.id AND ea.user_id = ?) THEN 'going'
          WHEN EXISTS (SELECT 1 FROM event_interested ei WHERE ei.event_id = e.id AND ei.user_id = ?) THEN 'interested'
          ELSE ''
        END AS my_rsvp_status
        
      FROM events e
      LEFT JOIN users u ON u.id = e.creator_id
      ${whereEventsSql}
      ORDER BY e.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // 6) GROUP POSTS - SIMPLE SHAPE
    // ============================================================
    const whereGroupPosts: string[] = [];
    const bindsGroupPosts: any[] = [];

    whereGroupPosts.push(`(gp.visibility IS NULL OR gp.visibility = 'public')`);

    if (cursor && cursor.trim()) {
      whereGroupPosts.push(`gp.created_at < ?`);
      bindsGroupPosts.push(cursor.trim());
    }
    if (seen.length > 0) {
      whereGroupPosts.push(`gp.id NOT IN (${seen.map(() => "?").join(",")})`);
      bindsGroupPosts.push(...seen);
    }

    const whereGroupPostsSql = whereGroupPosts.length ? `WHERE ${whereGroupPosts.join(" AND ")}` : "";

    const selectGroupPosts = `
      SELECT
        gp.id,
        gp.user_id,
        gp.content,
        gp.visibility,
        0 AS views,
        0 AS shares,
        gp.media_url,
        CASE
          WHEN gp.media_url LIKE '%.mp4%' OR gp.media_url LIKE '%.webm%' OR gp.media_url LIKE '%.mov%' THEN 'video'
          ELSE 'image'
        END AS media_type,
        gp.media_urls,
        NULL AS media_types,
        gp.created_at,
        
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role,
        
        g.id AS group_id,
        g.name AS group_name,
        g.profile_image AS group_image,
        
        (SELECT COUNT(*) FROM group_post_reactions gpr WHERE gpr.group_post_id = gp.id) AS reactions_count,
        (SELECT gpr.type FROM group_post_reactions gpr WHERE gpr.group_post_id = gp.id AND gpr.user_id = ? LIMIT 1) AS my_reaction,
        0 AS comments_count,
        
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
              gpr3.user_id,
              LOWER(COALESCE(gpr3.type,'like')) AS type,
              COALESCE(u3.name, u3.username, '') AS name,
              u3.profile_image_url
            FROM group_post_reactions gpr3
            LEFT JOIN users u3 ON u3.id = gpr3.user_id
            WHERE gpr3.group_post_id = gp.id
            ORDER BY gpr3.created_at DESC, gpr3.id DESC
            LIMIT 30
          ) x
        ) AS reactions_preview
        
      FROM group_posts gp
      LEFT JOIN users u ON u.id = gp.user_id
      LEFT JOIN groups g ON g.id = gp.group_id
      ${whereGroupPostsSql}
      ORDER BY gp.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // 7) PRODUCTS - SIMPLE SHAPE
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
        pr.seller_id AS user_id,
        pr.title AS content,
        'public' AS visibility,
        0 AS views,
        0 AS shares,
        NULL AS media_url,
        NULL AS media_type,
        pr.images AS media_urls,
        NULL AS media_types,
        pr.created_at,
        
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role,
        
        0 AS reactions_count,
        NULL AS my_reaction,
        0 AS comments_count,
        NULL AS reactions_preview,
        
        'marketplace' AS type,
        'product' AS post_type,
        pr.id AS product_id,
        pr.main_price,
        pr.discount_price,
        pr.currency_symbol,
        pr.address AS location
        
      FROM products pr
      LEFT JOIN users u ON u.id = pr.seller_id
      ${whereProductsSql}
      ORDER BY pr.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // 8) ADS / SPONSORED POSTS - SIMPLE SHAPE
    // ============================================================
    const whereAds: string[] = [];
    const bindsAds: any[] = [];

    // Only show active ads
    whereAds.push(`a.status = 'active'`);

    if (cursor && cursor.trim()) {
      whereAds.push(`a.created_at < ?`);
      bindsAds.push(cursor.trim());
    }
    if (seen.length > 0) {
      whereAds.push(`a.id NOT IN (${seen.map(() => "?").join(",")})`);
      bindsAds.push(...seen);
    }

    const whereAdsSql = whereAds.length ? `WHERE ${whereAds.join(" AND ")}` : "";

    const selectAds = `
      SELECT
        a.id,
        a.advertiser_id AS user_id,
        a.title AS content,
        a.description,
        'public' AS visibility,
        a.impressions AS views,
        0 AS shares,
        a.media_url,
        a.media_type,
        a.media_urls,
        a.media_types,
        a.created_at,
        
        COALESCE(u.username, 'advertiser') AS username,
        COALESCE(u.name, u.username, 'Sponsored') AS name,
        u.profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'business') AS role,
        
        -- Original post metrics
        CASE 
          WHEN a.post_id IS NOT NULL 
          THEN (SELECT COUNT(*) FROM post_reactions WHERE post_id = a.post_id)
          ELSE 0 
        END AS reactions_count,
        
        CASE 
          WHEN a.post_id IS NOT NULL 
          THEN (SELECT COUNT(*) FROM post_comments WHERE post_id = a.post_id)
          ELSE 0 
        END AS comments_count,
        
        CASE 
          WHEN a.post_id IS NOT NULL 
          THEN (SELECT shares FROM posts WHERE id = a.post_id)
          ELSE 0 
        END AS shares,
        
        NULL AS my_reaction,
        NULL AS reactions_preview,
        
        -- Ad-specific fields (your Feed.tsx will ignore these)
        a.cta_button AS cta_text,
        a.destination_url AS cta_url,
        a.contact_type AS cta_type,
        a.campaign_name,
        a.status AS campaign_status,
        a.start_date,
        a.end_date,
        1 AS is_sponsored,
        a.target_location,
        a.target_country,
        a.target_city
        
      FROM ads a
      LEFT JOIN users u ON u.id = a.advertiser_id
      ${whereAdsSql}
      ORDER BY a.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // RUN QUERIES (Fresh)
    // ============================================================
    const runQueries = async (count: number, orderBy: 'DESC' | 'RANDOM()') => {
      const postsQuery = selectPosts.replace('ORDER BY p.created_at DESC', `ORDER BY p.created_at ${orderBy === 'RANDOM()' ? 'RANDOM()' : 'DESC'}`);
      const reelsQuery = selectReels.replace('ORDER BY r.created_at DESC', `ORDER BY r.created_at ${orderBy === 'RANDOM()' ? 'RANDOM()' : 'DESC'}`);
      const songsQuery = selectSongs.replace('ORDER BY s.created_at DESC', `ORDER BY s.created_at ${orderBy === 'RANDOM()' ? 'RANDOM()' : 'DESC'}`);
      const podcastsQuery = selectPodcasts.replace('ORDER BY pc.created_at DESC', `ORDER BY pc.created_at ${orderBy === 'RANDOM()' ? 'RANDOM()' : 'DESC'}`);
      const eventsQuery = selectEvents.replace('ORDER BY e.created_at DESC', `ORDER BY e.created_at ${orderBy === 'RANDOM()' ? 'RANDOM()' : 'DESC'}`);
      const groupPostsQuery = selectGroupPosts.replace('ORDER BY gp.created_at DESC', `ORDER BY gp.created_at ${orderBy === 'RANDOM()' ? 'RANDOM()' : 'DESC'}`);
      const productsQuery = selectProducts.replace('ORDER BY pr.created_at DESC', `ORDER BY pr.created_at ${orderBy === 'RANDOM()' ? 'RANDOM()' : 'DESC'}`);
      const adsQuery = selectAds.replace('ORDER BY a.created_at DESC', `ORDER BY a.created_at ${orderBy === 'RANDOM()' ? 'RANDOM()' : 'DESC'}`);

      const [posts, reels, songs, podcasts, events, groupPosts, products, ads] = await Promise.all([
        env.DB.prepare(postsQuery).bind(reactionUserId, ...bindsPosts, count).all(),
        env.DB.prepare(reelsQuery).bind(reactionUserId, ...bindsReels, count).all(),
        env.DB.prepare(songsQuery).bind(reactionUserId, ...bindsSongs, count).all(),
        env.DB.prepare(podcastsQuery).bind(...bindsPodcasts, count).all(),
        env.DB.prepare(eventsQuery).bind(reactionUserId, reactionUserId, ...bindsEvents, count).all(),
        env.DB.prepare(groupPostsQuery).bind(reactionUserId, ...bindsGroupPosts, count).all(),
        env.DB.prepare(productsQuery).bind(...bindsProducts, count).all(),
        env.DB.prepare(adsQuery).bind(...bindsAds, Math.min(3, count)).all(),
      ]);

      return {
        posts: Array.isArray(posts?.results) ? posts.results : [],
        reels: Array.isArray(reels?.results) ? reels.results : [],
        songs: Array.isArray(songs?.results) ? songs.results : [],
        podcasts: Array.isArray(podcasts?.results) ? podcasts.results : [],
        events: Array.isArray(events?.results) ? events.results : [],
        groupPosts: Array.isArray(groupPosts?.results) ? groupPosts.results : [],
        products: Array.isArray(products?.results) ? products.results : [],
        ads: Array.isArray(ads?.results) ? ads.results : [],
      };
    };

    const fresh = await runQueries(freshCount, 'DESC');
    const explore = exploreCount > 0 ? await runQueries(exploreCount, 'RANDOM()') : null;

    // ============================================================
    // Merge all items - SIMPLE SHAPE (no source, item_type, feed_key)
    // ============================================================
    const allItems = [
      ...fresh.posts,
      ...fresh.reels,
      ...fresh.songs,
      ...fresh.podcasts,
      ...fresh.events,
      ...fresh.groupPosts,
      ...fresh.products,
      ...fresh.ads,
      ...(explore?.posts || []),
      ...(explore?.reels || []),
      ...(explore?.songs || []),
      ...(explore?.podcasts || []),
      ...(explore?.events || []),
      ...(explore?.groupPosts || []),
      ...(explore?.products || []),
      ...(explore?.ads || []),
    ];

    // Remove duplicates by ID
    const uniqueItems = Array.from(
      new Map(allItems.map(item => [item.id, item])).values()
    );

    // Sort by created_at DESC
    const sorted = uniqueItems.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Shuffle with seed
    const shuffled = seededShuffle(sorted, seed);

    // Get next cursor
    const oldest = shuffled.length > 0 ? shuffled[shuffled.length - 1] : null;
    const nextCursor = oldest?.created_at || null;

    // Check if more items exist
    let hasMore = false;
    if (nextCursor) {
      const checkMore = await env.DB.prepare(
        `SELECT id FROM posts WHERE created_at < ? LIMIT 1`
      ).bind(nextCursor).first();
      hasMore = !!checkMore;
    }

    // Normalize media for all items
    const feed = shuffled.map(item => ({
      ...item,
      ...normalizeMedia(item),
    }));

    const payload = {
      success: true,
      userId,
      limit,
      cursor: cursor || null,
      nextCursor,
      hasMore,
      feed,
      products: fresh.products, // Separate products list if needed
    };

    if (debug) {
      return json({
        ...payload,
        debug: {
          seenCount: seen.length,
          returnedCount: feed.length,
          fresh: {
            posts: fresh.posts.length,
            reels: fresh.reels.length,
            songs: fresh.songs.length,
            podcasts: fresh.podcasts.length,
            events: fresh.events.length,
            groupPosts: fresh.groupPosts.length,
            products: fresh.products.length,
            ads: fresh.ads.length,
          },
          explore: explore ? {
            posts: explore.posts.length,
            reels: explore.reels.length,
            songs: explore.songs.length,
            podcasts: explore.podcasts.length,
            events: explore.events.length,
            groupPosts: explore.groupPosts.length,
            products: explore.products.length,
            ads: explore.ads.length,
          } : null,
        },
      });
    }

    return json(payload);
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
