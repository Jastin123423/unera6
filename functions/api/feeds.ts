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

const parseSeenIds = (raw: string | null, max = 200) => {
  if (!raw) return [];
  const ids = raw
    .split(',')
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  // dedup + cap
  return Array.from(new Set(ids)).slice(0, max);
};

// small seeded shuffle (deterministic)
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

    // client controls
    const limit = clamp(toInt(url.searchParams.get('limit'), 20), 1, 50);
    const cursor = url.searchParams.get('cursor'); // ISO timestamp; fetch older than this
    const seed = toInt(url.searchParams.get('seed'), 1);

    // seen ids: "1,2,3"
    const seen = parseSeenIds(url.searchParams.get('seen'), 250);

    // We blend feed from two pools:
    // 1) "fresh" pool: newest posts (optionally older-than cursor)
    // 2) "explore" pool: random older posts to avoid boredom
    //
    // Then we dedup and seeded-shuffle final result so order changes per session/return.
    const freshCount = Math.max(5, Math.floor(limit * 0.65));
    const exploreCount = Math.max(0, limit - freshCount);

    // build WHERE filters
    const where: string[] = [];
    const binds: any[] = [];

    // visibility: keep it simple; adjust if you have privacy rules
    where.push(`(p.visibility IS NULL OR p.visibility = 'public')`);


    // cursor: older-than
    if (cursor && typeof cursor === 'string' && cursor.trim().length > 0) {
      where.push(`p.created_at < ?`);
      binds.push(cursor.trim());
    }

    // exclude seen
    if (seen.length > 0) {
      where.push(`p.id NOT IN (${seen.map(() => '?').join(',')})`);
      binds.push(...seen);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const baseSelect = `
      SELECT
        p.id, p.user_id, p.content,

        -- ✅ block huge base64 post media
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

        p.visibility, p.created_at, p.views, p.shares,
        u.username,

        -- ✅ block huge base64 profile images
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,

        u.is_verified, u.role
      FROM posts p
      JOIN users u ON u.id = p.user_id
    `;

    // 1) Fresh pool: newest first
    const qFresh = `
      ${baseSelect}
      ${whereSql}
      ORDER BY p.created_at DESC
      LIMIT ?
    `;

    const fresh = await env.DB
      .prepare(qFresh)
      .bind(...binds, freshCount)
      .all()
      .then((r) => (Array.isArray(r?.results) ? r.results : []));

    // 2) Explore pool: random older (within last ~90 days if you want; here unlimited)
    // If you want to limit to recent-ish posts, uncomment:
    // AND p.created_at >= datetime('now', '-90 days')
    let explore: any[] = [];
    if (exploreCount > 0) {
      const qExplore = `
        ${baseSelect}
        ${whereSql}
        ORDER BY RANDOM()
        LIMIT ?
      `;

      explore = await env.DB
        .prepare(qExplore)
        .bind(...binds, exploreCount)
        .all()
        .then((r) => (Array.isArray(r?.results) ? r.results : []));
    }

    // merge + dedup by id
    const mergedMap = new Map<number, any>();
    for (const row of [...fresh, ...explore]) {
      const id = Number((row as any)?.id);
      if (!Number.isFinite(id)) continue;
      if (!mergedMap.has(id)) mergedMap.set(id, row);
    }

    const merged = Array.from(mergedMap.values());

    // seed shuffle => different order per session/return
    const ordered = seededShuffle(merged, seed);

    // next cursor = last item's created_at (for pagination)
    const last = ordered.length ? ordered[ordered.length - 1] : null;
    const nextCursor = last?.created_at ?? null;

    // hasMore check: do we have any posts older than nextCursor (ignoring seen)
    let hasMore = false;
    if (nextCursor) {
      const whereMore: string[] = [`p.visibility = 'public'`, `p.created_at < ?`];
      const bindsMore: any[] = [nextCursor];

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
