// functions/api/reels/[id]/view.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ params, env }) => {
  const reelId = Number(params.id);
  if (!Number.isFinite(reelId)) return json({ success: false, error: "Invalid reel id" }, 400);

  await env.DB.prepare(`
    UPDATE reels
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = ?
  `).bind(reelId).run();

  const row = await env.DB.prepare(`
    SELECT COALESCE(views_count, 0) as views_count
    FROM reels
    WHERE id = ?
  `).bind(reelId).first();

  return json({
    success: true,
    reel_id: reelId,
    views_count: Number(row?.views_count || 0),
  });
};
