import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const reel_id = toNum((params as any)?.id, 0);
    const url = new URL(request.url);

    const limit = Math.min(toNum(url.searchParams.get('limit'), 100), 500);
    const offset = Math.max(toNum(url.searchParams.get('offset'), 0), 0);
    const type = String(url.searchParams.get('type') || '').trim().toLowerCase();

    if (!reel_id) {
      return json({ success: false, error: 'Invalid reel id' }, 400);
    }

    const allowed = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
    const filterByType = type && allowed.includes(type);

    const baseSql = `
      SELECT
        rr.id,
        rr.reel_id,
        rr.user_id,
        rr.type,
        rr.created_at,
        u.id AS user_join_id,
        u.name,
        u.username,
        u.profile_image_url,
        u.profileImage
      FROM reel_reactions rr
      LEFT JOIN users u
        ON u.id = rr.user_id
      WHERE rr.reel_id = ?
      ${filterByType ? 'AND rr.type = ?' : ''}
      ORDER BY rr.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const stmt = filterByType
      ? env.DB.prepare(baseSql).bind(reel_id, type, limit, offset)
      : env.DB.prepare(baseSql).bind(reel_id, limit, offset);

    const result = await stmt.all();

    const reactions = (Array.isArray(result.results) ? result.results : []).map((row: any) => ({
      id: Number(row.id),
      reel_id: Number(row.reel_id),
      user_id: Number(row.user_id),
      type: String(row.type || 'like'),
      created_at: row.created_at,
      name: row.name || null,
      username: row.username || null,
      profile_image_url: row.profile_image_url || row.profileImage || null,
      user: {
        id: Number(row.user_id),
        name: row.name || null,
        username: row.username || null,
        profile_image_url: row.profile_image_url || row.profileImage || null,
      },
    }));

    const breakdownRes = await env.DB
      .prepare(
        `SELECT type, COUNT(*) as count
         FROM reel_reactions
         WHERE reel_id = ?
         GROUP BY type`
      )
      .bind(reel_id)
      .all();

    const reactions_breakdown = Array.isArray(breakdownRes.results)
      ? breakdownRes.results.map((r: any) => ({
          type: String(r.type || 'like'),
          count: toNum(r.count, 0),
        }))
      : [];

    return json({
      success: true,
      reel_id,
      reactions,
      count: reactions.length,
      reactions_breakdown,
    });
  } catch (e: any) {
    return json(
      { success: false, error: e?.message || 'Failed to fetch reel reactions' },
      500
    );
  }
};
