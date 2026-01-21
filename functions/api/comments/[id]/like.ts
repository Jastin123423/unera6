

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
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ env, params, request }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const commentId = toInt((params as any)?.id, 0);
    if (!commentId) return json({ success: false, error: "Invalid comment id" }, 400);

    const body = await request.json().catch(() => ({}));
    const userId = toInt(body?.user_id, 0);
    if (!userId) return json({ success: false, error: "user_id is required" }, 400);

    // toggle like (type is always "like")
    const existing = await env.DB
      .prepare(`SELECT id FROM comment_reactions WHERE comment_id = ? AND user_id = ? LIMIT 1`)
      .bind(commentId, userId)
      .first();

    if (existing?.id) {
      await env.DB
        .prepare(`DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ?`)
        .bind(commentId, userId)
        .run();
    } else {
      await env.DB
        .prepare(`INSERT INTO comment_reactions (comment_id, user_id, type) VALUES (?, ?, 'like')`)
        .bind(commentId, userId)
        .run();
    }

    const countRow = await env.DB
      .prepare(`SELECT COUNT(*) as c FROM comment_reactions WHERE comment_id = ?`)
      .bind(commentId)
      .first();

    const reactions_count = toInt((countRow as any)?.c, 0);
    const my_reaction = existing?.id ? null : "like";

    return json({ success: true, comment_id: commentId, reactions_count, my_reaction });
  } catch (e: any) {
    return 
