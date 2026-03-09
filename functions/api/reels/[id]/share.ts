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
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const reel_id = Number(params.id);

    if (!reel_id) {
      return json({ success: false, error: 'Invalid reel id' }, 400);
    }

    const body = await request.json().catch(() => ({}));

    const user_id =
      Number(request.headers.get('x-user-id')) ||
      Number((body as any).user_id);

    if (!user_id) {
      return json({ success: false, error: 'user_id required' }, 400);
    }

    const destination = (body as any)?.destination ?? null;

    const reel = await env.DB
      .prepare(`SELECT id FROM reels WHERE id = ?`)
      .bind(reel_id)
      .first();

    if (!reel) {
      return json({ success: false, error: 'Reel not found' }, 404);
    }

    const result = await env.DB
      .prepare(`
        INSERT INTO reel_shares (reel_id, user_id, destination)
        VALUES (?, ?, ?)
      `)
      .bind(reel_id, user_id, destination)
      .run();

    const share_id = result.meta.last_row_id;

    const share = await env.DB
      .prepare(`
        SELECT id, reel_id, user_id, destination, created_at
        FROM reel_shares
        WHERE id = ?
      `)
      .bind(share_id)
      .first();

    const countRow = await env.DB
      .prepare(`
        SELECT COUNT(*) as cnt
        FROM reel_shares
        WHERE reel_id = ?
      `)
      .bind(reel_id)
      .first();

    return json({
      success: true,
      share,
      shares_count: Number((countRow as any)?.cnt || 0),
    });

  } catch (err: any) {
    return json({ success: false, error: err?.message || 'Server error' }, 500);
  }
};
