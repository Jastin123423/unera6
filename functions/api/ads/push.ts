import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = Number(request.headers.get("x-user-id"));
    if (!userId) return json({ error: "Missing user id" }, 400);

    const body = await request.json();
    const { post_id, budget, days } = body;

    if (!post_id || !budget) {
      return json({ error: "post_id and budget required" }, 400);
    }

    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + (days || 3));

    const result = await env.DB.prepare(`
      INSERT INTO ads (
        advertiser_id,
        post_id,
        budget,
        start_date,
        end_date,
        status
      )
      VALUES (?, ?, ?, ?, ?, 'active')
    `)
      .bind(userId, post_id, budget, start.toISOString(), end.toISOString())
      .run();

    return json({
      success: true,
      ad_id: result.meta.last_row_id
    });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
};
