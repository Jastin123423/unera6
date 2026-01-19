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
    const cursor = url.searchParams.get('cursor'); // ISO timestamp older-than
    const seed = toInt(url.searchParams.get('seed'), 1);
    const seen = parseSeenIds(url.searchParams.get('seen'), 250);
    const debug = url.searchParams.get('debug') === '1';

    const freshCount = Math.max(5, Math.floor(limit * 0.65));
    const exploreCount = Math.max(0, limit - freshCount);

    const where: string[] = [];
    const binds: any[] = [];

    // visibility
    where.push(`(p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')`);

    if (cursor && typeof cursor === 'string' && cursor.trim().length > 0) {
      where.push(`p.created_at < ?`);
      binds.push(cursor.trim());
    }

    if (seen.length > 0) {
      where.push(`p.id NOT IN (${seen.map(() => '?').join(',')})`);
      binds.push(...seen);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // ✅ baseSelect now includes reactions_count + my_reaction
    // IMPORTANT: my_reaction uses "?" so we MUST bind userId first in every query.
    const baseSelect = `
      SELECT
        p.id,
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

        p.visibility,
        p.created_at,
        p.views,
        p.shares,

        -- ✅ reactions
        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,

        (SELECT pr.type
          FROM post_reactions pr
          WHERE pr.post_id = p.id
            AND pr.user_id = ?
          LIMIT 1
        ) AS my_reaction,

        -- Safe user fields
        COALESCE(u.username, 'user') AS username,

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

    // 1) Fresh pool
    const qFresh = `
      ${baseSelect}
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT ?
    `;

    // ✅ Bind order:
    //  - first: userId (for my_reaction "?")
    //  - then: binds (cursor/seen)
    //  - last: limit
    const freshRes = await env.DB.prepare(qFresh).bind(userId, ...binds, freshCount).all();
    const fresh = Array.isArray(freshRes?.results) ? freshRes.results : [];

    // 2) Explore pool
    let explore: any[] = [];
    if (exploreCount > 0) {
      const qExplore = `
        ${baseSelect}
        ${whereSql}
        ORDER BY RANDOM()
        LIMIT ?
      `;
      const exploreRes = await env.DB.prepare(qExplore).bind(userId, ...binds, exploreCount).all();
      explore = Array.isArray(exploreRes?.results) ? exploreRes.results : [];
    }

    // Merge + dedup
    const map = new Map<number, any>();
    for (const row of [...fresh, ...explore]) {
      const id = Number((row as any)?.id);
      if (!Number.isFinite(id)) continue;
      if (!map.has(id)) map.set(id, row);
    }

    const merged = Array.from(map.values());
    const ordered = seededShuffle(merged, seed);

    const last = ordered.length ? ordered[ordered.length - 1] : null;
    const nextCursor = last?.created_at ?? null;

    // hasMore
    let hasMore = false;
    if (nextCursor) {
      const whereMore: string[] = [];
      const bindsMore: any[] = [];

      whereMore.push(`(p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')`);
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
      hasMore = !!more;
    }

    // Debug info
    if (debug) {
      const totalPosts = await env.DB.prepare(`SELECT COUNT(*) as c FROM posts`).first();
      const joinableUsers = await env.DB
        .prepare(`SELECT COUNT(*) as c FROM posts p JOIN users u ON u.id = p.user_id`)
        .first();
      const publicOrNull = await env.DB
        .prepare(
          `SELECT COUNT(*) as c FROM posts p WHERE (p.visibility IS NULL OR p.visibility = 'public' OR p.visibility = '' OR p.visibility = 'Public')`
        )
        .first();

      return json({
        success: true,
        userId,
        limit,
        cursor: cursor ?? null,
        nextCursor,
        hasMore,
        feed: ordered,
        debug: {
          totalPosts: (totalPosts as any)?.c ?? null,
          joinableUsers: (joinableUsers as any)?.c ?? null,
          publicOrNull: (publicOrNull as any)?.c ?? null,
          seenCount: seen.length,
          returned: ordered.length,
        },
      });
    }

    return json({
      success: true,
      userId,
      limit,
      cursor: cursor ?? null,
      nextCursor,
      hasMore,
      feed: ordered,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
