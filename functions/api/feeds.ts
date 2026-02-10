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

    // Optional: only include one group if provided
    const groupId = toInt(url.searchParams.get('groupId'), 0);

    const freshCount = Math.max(5, Math.floor(limit * 0.65));
    const exploreCount = Math.max(0, limit - freshCount);

    // ----------------------------
    // POSTS filters
    // ----------------------------
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

    // must bind userId for "my_reaction" query
    const baseSelectPosts = `
      SELECT
        'post' AS source,
        p.id AS id,
        p.created_at AS created_at,

        /* common author fields */
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

        /* common content fields */
        'post' AS item_type,
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

        /* post-only */
        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,
        (SELECT pr.type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = ? LIMIT 1) AS my_reaction,

        /* group fields (null) */
        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_privacy,

        /* reels fields (null) */
        NULL AS video_url,
        NULL AS caption,
        NULL AS song_name,
        NULL AS audio_url,
        0 AS audio_start,
        0 AS audio_end,
        NULL AS location,
        NULL AS song_id,
        NULL AS sound_key,
        NULL AS sound_id
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
    `;

    // ----------------------------
    // GROUP POSTS filters (PUBLIC groups visible to everyone)
    // ----------------------------
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

    // privacy rule
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

        'group_post' AS item_type,
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
        NULL AS sound_id
      FROM group_posts gp
      JOIN groups g ON g.id = gp.group_id
      LEFT JOIN users u ON u.id = gp.user_id
    `;

    // ----------------------------
    // REELS filters (public reels visible to everyone)
    // ----------------------------
    const whereReels: string[] = [];
    const bindsReels: any[] = [];

    // visibility
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

    // must bind userId for "my_like_type"
    const baseSelectReels = `
      SELECT
        'reel' AS source,
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

        'reel' AS item_type,
        NULL AS content,
        r.visibility AS visibility,
        r.views AS views,
        r.shares AS shares,

        /* keep media_url fields compatible; reels use video_url */
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
        r.sound_id AS sound_id
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
    `;

    // ----------------------------
    // 1) Fresh pool (each source)
    // ----------------------------
    const qFreshPosts = `
      ${baseSelectPosts}
      ${wherePostsSql}
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    const freshPostsRes = await env.DB.prepare(qFreshPosts)
      .bind(userId, ...bindsPosts, freshCount)
      .all();
    const freshPosts = Array.isArray(freshPostsRes?.results) ? freshPostsRes.results : [];

    const qFreshGroups = `
      ${baseSelectGroupPosts}
      ${whereGroupsSql}
      ORDER BY gp.created_at DESC
      LIMIT ?
    `;
    const freshGroupsRes = await env.DB.prepare(qFreshGroups)
      .bind(...bindsGroups, freshCount)
      .all();
    const freshGroups = Array.isArray(freshGroupsRes?.results) ? freshGroupsRes.results : [];

    const qFreshReels = `
      ${baseSelectReels}
      ${whereReelsSql}
      ORDER BY r.created_at DESC
      LIMIT ?
    `;
    const freshReelsRes = await env.DB.prepare(qFreshReels)
      .bind(userId, ...bindsReels, freshCount)
      .all();
    const freshReels = Array.isArray(freshReelsRes?.results) ? freshReelsRes.results : [];

    // ----------------------------
    // 2) Explore pool (random)
    // ----------------------------
    let explorePosts: any[] = [];
    let exploreGroups: any[] = [];
    let exploreReels: any[] = [];

    if (exploreCount > 0) {
      const qExplorePosts = `
        ${baseSelectPosts}
        ${wherePostsSql}
        ORDER BY RANDOM()
        LIMIT ?
      `;
      const explorePostsRes = await env.DB.prepare(qExplorePosts)
        .bind(userId, ...bindsPosts, exploreCount)
        .all();
      explorePosts = Array.isArray(explorePostsRes?.results) ? explorePostsRes.results : [];

      const qExploreGroups = `
        ${baseSelectGroupPosts}
        ${whereGroupsSql}
        ORDER BY RANDOM()
        LIMIT ?
      `;
      const exploreGroupsRes = await env.DB.prepare(qExploreGroups)
        .bind(...bindsGroups, exploreCount)
        .all();
      exploreGroups = Array.isArray(exploreGroupsRes?.results) ? exploreGroupsRes.results : [];

      const qExploreReels = `
        ${baseSelectReels}
        ${whereReelsSql}
        ORDER BY RANDOM()
        LIMIT ?
      `;
      const exploreReelsRes = await env.DB.prepare(qExploreReels)
        .bind(userId, ...bindsReels, exploreCount)
        .all();
      exploreReels = Array.isArray(exploreReelsRes?.results) ? exploreReelsRes.results : [];
    }

    // ----------------------------
    // Merge + dedup (prevent collisions)
    // ----------------------------
    const map = new Map<string, any>();
    const allRows = [
      ...freshPosts,
      ...freshGroups,
      ...freshReels,
      ...explorePosts,
      ...exploreGroups,
      ...exploreReels,
    ];

    for (const row of allRows) {
      const src = String((row as any)?.source || '');
      const id = Number((row as any)?.id);
      if (!src || !Number.isFinite(id)) continue;

      const key = `${src}:${id}`;
      if (!map.has(key)) map.set(key, row);
    }

    const merged = Array.from(map.values());

    // nextCursor = oldest created_at among returned rows
    const oldest = merged.reduce((acc: any, cur: any) => {
      if (!acc) return cur;
      return String(cur.created_at) < String(acc.created_at) ? cur : acc;
    }, null as any);

    const nextCursor = oldest?.created_at ?? null;

    // Shuffle for variety
    const ordered = seededShuffle(merged, seed);

    // ----------------------------
    // hasMore check (posts OR groups OR reels)
    // ----------------------------
    let hasMore = false;

    if (nextCursor) {
      // posts
      {
        const w: string[] = [];
        const b: any[] = [];

        w.push(
          `(p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')`
        );
        w.push(`p.created_at < ?`);
        b.push(nextCursor);

        if (seen.length > 0) {
          w.push(`p.id NOT IN (${seen.map(() => '?').join(',')})`);
          b.push(...seen);
        }

        const q = `
          SELECT p.id
          FROM posts p
          ${w.length ? `WHERE ${w.join(' AND ')}` : ''}
          ORDER BY p.created_at DESC
          LIMIT 1
        `;
        const r = await env.DB.prepare(q).bind(...b).first();
        if (r) hasMore = true;
      }

      // group_posts
      if (!hasMore) {
        const w: string[] = [];
        const b: any[] = [];

        w.push(`gp.created_at < ?`);
        b.push(nextCursor);

        if (seen.length > 0) {
          w.push(`gp.id NOT IN (${seen.map(() => '?').join(',')})`);
          b.push(...seen);
        }

        if (groupId > 0) {
          w.push(`gp.group_id = ?`);
          b.push(groupId);
        }

        w.push(`
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
        b.push(userId);

        const q = `
          SELECT gp.id
          FROM group_posts gp
          JOIN groups g ON g.id = gp.group_id
          ${w.length ? `WHERE ${w.join(' AND ')}` : ''}
          ORDER BY gp.created_at DESC
          LIMIT 1
        `;
        const r = await env.DB.prepare(q).bind(...b).first();
        if (r) hasMore = true;
      }

      // reels
      if (!hasMore) {
        const w: string[] = [];
        const b: any[] = [];

        w.push(
          `(r.visibility IS NULL OR r.visibility = 'public' OR r.visibility = '' OR r.visibility = 'Public')`
        );
        w.push(`r.created_at < ?`);
        b.push(nextCursor);

        if (seen.length > 0) {
          w.push(`r.id NOT IN (${seen.map(() => '?').join(',')})`);
          b.push(...seen);
        }

        const q = `
          SELECT r.id
          FROM reels r
          ${w.length ? `WHERE ${w.join(' AND ')}` : ''}
          ORDER BY r.created_at DESC
          LIMIT 1
        `;
        const r = await env.DB.prepare(q).bind(...b).first();
        if (r) hasMore = true;
      }
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
          fresh: { posts: freshPosts.length, groups: freshGroups.length, reels: freshReels.length },
          explore: {
            posts: explorePosts.length,
            groups: exploreGroups.length,
            reels: exploreReels.length,
          },
        },
      });
    }

    return json(payload);
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
