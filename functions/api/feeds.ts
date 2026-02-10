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

    // Optional: load only one group feed if you want
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

    if (cursor && cursor.trim().length > 0) {
      wherePosts.push(`p.created_at < ?`);
      bindsPosts.push(cursor.trim());
    }

    if (seen.length > 0) {
      wherePosts.push(`p.id NOT IN (${seen.map(() => '?').join(',')})`);
      bindsPosts.push(...seen);
    }

    const wherePostsSql = wherePosts.length ? `WHERE ${wherePosts.join(' AND ')}` : '';

    // Must bind userId FIRST because this select uses "my_reaction" subquery with pr.user_id = ?
    const baseSelectPosts = `
      SELECT
        'post' AS source,
        p.id AS id,
        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_privacy,
        p.user_id,
        p.content,

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

        p.visibility,
        p.created_at,
        p.views,
        p.shares,

        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,
        (SELECT pr.type
         FROM post_reactions pr
         WHERE pr.post_id = p.id AND pr.user_id = ?
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
        COALESCE(u.role, 'user') AS role
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
    `;

    // ----------------------------
    // GROUP POSTS filters (PUBLIC groups show to everyone)
    // Assumes: groups.privacy in ('public','private') default 'public'
    // Private group posts only show if user is in group_members.
    // ----------------------------
    const whereGroups: string[] = [];
    const bindsGroups: any[] = [];

    // Cursor
    if (cursor && cursor.trim().length > 0) {
      whereGroups.push(`gp.created_at < ?`);
      bindsGroups.push(cursor.trim());
    }

    // Seen
    if (seen.length > 0) {
      whereGroups.push(`gp.id NOT IN (${seen.map(() => '?').join(',')})`);
      bindsGroups.push(...seen);
    }

    // Optional: only one group feed
    if (groupId > 0) {
      whereGroups.push(`gp.group_id = ?`);
      bindsGroups.push(groupId);
    }

    // ✅ Core rule: public groups visible to all; private visible to members
    // We bind userId once for the EXISTS check.
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

    // Note: group_posts currently doesn't have reactions/multi-media fields.
    // We return compatible fields with defaults.
    const baseSelectGroupPosts = `
      SELECT
        'group' AS source,
        gp.id AS id,
        gp.group_id AS group_id,
        COALESCE(g.name, 'Group') AS group_name,
        COALESCE(g.privacy, 'public') AS group_privacy,
        gp.user_id,
        gp.content,

        CASE
          WHEN gp.media_url LIKE 'data:%' THEN NULL
          WHEN length(gp.media_url) > 300 THEN NULL
          ELSE gp.media_url
        END AS media_url,

        NULL AS media_type,
        NULL AS media_urls,
        NULL AS media_types,

        'Group' AS visibility,
        gp.created_at,
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
        COALESCE(u.role, 'user') AS role
      FROM group_posts gp
      JOIN groups g ON g.id = gp.group_id
      LEFT JOIN users u ON u.id = gp.user_id
    `;

    // ----------------------------
    // 1) Fresh pool
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

    // ----------------------------
    // 2) Explore pool (random)
    // ----------------------------
    let explorePosts: any[] = [];
    let exploreGroups: any[] = [];

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
    }

    // ----------------------------
    // Merge + dedup (prevent collisions)
    // ----------------------------
    const map = new Map<string, any>();
    const allRows = [...freshPosts, ...freshGroups, ...explorePosts, ...exploreGroups];

    for (const row of allRows) {
      const src = String((row as any)?.source || '');
      const id = Number((row as any)?.id);
      if (!src || !Number.isFinite(id)) continue;

      const key = `${src}:${id}`; // prevents id collisions
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
    // hasMore (check posts OR group_posts)
    // ----------------------------
    let hasMore = false;

    if (nextCursor) {
      // posts hasMore
      {
        const whereMore: string[] = [];
        const bindsMore: any[] = [];

        whereMore.push(
          `(p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')`
        );
        whereMore.push(`p.created_at < ?`);
        bindsMore.push(nextCursor);

        if (seen.length > 0) {
          whereMore.push(`p.id NOT IN (${seen.map(() => '?').join(',')})`);
          bindsMore.push(...seen);
        }

        const qMore = `
          SELECT p.id
          FROM posts p
          ${whereMore.length ? `WHERE ${whereMore.join(' AND ')}` : ''}
          ORDER BY p.created_at DESC
          LIMIT 1
        `;
        const more = await env.DB.prepare(qMore).bind(...bindsMore).first();
        if (more) hasMore = true;
      }

      // group_posts hasMore
      if (!hasMore) {
        const whereMoreG: string[] = [];
        const bindsMoreG: any[] = [];

        whereMoreG.push(`gp.created_at < ?`);
        bindsMoreG.push(nextCursor);

        if (seen.length > 0) {
          whereMoreG.push(`gp.id NOT IN (${seen.map(() => '?').join(',')})`);
          bindsMoreG.push(...seen);
        }

        if (groupId > 0) {
          whereMoreG.push(`gp.group_id = ?`);
          bindsMoreG.push(groupId);
        }

        // Same privacy rule
        whereMoreG.push(`
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
        bindsMoreG.push(userId);

        const qMoreG = `
          SELECT gp.id
          FROM group_posts gp
          JOIN groups g ON g.id = gp.group_id
          ${whereMoreG.length ? `WHERE ${whereMoreG.join(' AND ')}` : ''}
          ORDER BY gp.created_at DESC
          LIMIT 1
        `;
        const moreG = await env.DB.prepare(qMoreG).bind(...bindsMoreG).first();
        if (moreG) hasMore = true;
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
          freshPosts: freshPosts.length,
          freshGroups: freshGroups.length,
          explorePosts: explorePosts.length,
          exploreGroups: exploreGroups.length,
        },
      });
    }

    return json(payload);
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
