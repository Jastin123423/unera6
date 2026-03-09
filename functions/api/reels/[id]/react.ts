import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
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

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const reel_id = toNum((params as any)?.id, 0);
    const body = await request.json().catch(() => ({} as any));

    const headerUserId = toNum(request.headers.get('x-user-id'), 0);
    const bodyUserId = toNum(body.user_id, 0);
    const user_id = headerUserId || bodyUserId || 0;

    const type = String(body.type || 'love').trim().toLowerCase();

    const allowed = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
    if (!allowed.includes(type)) {
      return json({ success: false, error: 'Invalid reaction type' }, 400);
    }

    if (!reel_id) {
      return json({ success: false, error: 'Invalid reel id' }, 400);
    }

    if (!user_id) {
      return json({ success: false, error: 'user_id is required' }, 400);
    }

    const reel = await env.DB
      .prepare(`SELECT id FROM reels WHERE id = ? LIMIT 1`)
      .bind(reel_id)
      .first();

    if (!reel) {
      return json({ success: false, error: 'Reel not found' }, 404);
    }

    const existing = await env.DB
      .prepare(
        `SELECT id, type
         FROM reel_reactions
         WHERE reel_id = ? AND user_id = ?
         LIMIT 1`
      )
      .bind(reel_id, user_id)
      .first();

    let reacted = false;
    let finalType: string | null = null;

    if ((existing as any)?.id) {
      const existingType = String((existing as any)?.type || 'love');

      if (existingType === type) {
        await env.DB
          .prepare(
            `DELETE FROM reel_reactions
             WHERE reel_id = ? AND user_id = ?`
          )
          .bind(reel_id, user_id)
          .run();

        reacted = false;
        finalType = null;
      } else {
        await env.DB
          .prepare(
            `UPDATE reel_reactions
             SET type = ?
             WHERE reel_id = ? AND user_id = ?`
          )
          .bind(type, reel_id, user_id)
          .run();

        reacted = true;
        finalType = type;
      }
    } else {
      await env.DB
        .prepare(
          `INSERT INTO reel_reactions (reel_id, user_id, type)
           VALUES (?, ?, ?)`
        )
        .bind(reel_id, user_id, type)
        .run();

      reacted = true;
      finalType = type;
    }

    const countRow = await env.DB
      .prepare(
        `SELECT COUNT(*) as c
         FROM reel_reactions
         WHERE reel_id = ?`
      )
      .bind(reel_id)
      .first();

    const reactions_count = toNum((countRow as any)?.c, 0);

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
      ? breakdownRes.results
      : [];

    return json({
      success: true,
      reacted,
      reactions_count,
      type: finalType,
      reactions_breakdown,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};
