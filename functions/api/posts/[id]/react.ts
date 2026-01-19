import type { PagesFunction } from '@cloudflare/workers-types';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  const post_id = Number((params as any)?.id);
  if (!post_id) return Response.json({ error: "Invalid post id" }, { status: 400, headers: cors });

  const body = await request.json().catch(() => ({} as any));
  const user_id = Number(body.user_id ?? 0);
  const type = String(body.type || "like").trim();

  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400, headers: cors });
  }

  // check existing reaction
  const existing = await env.DB.prepare(
    `SELECT type FROM post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1`
  ).bind(post_id, user_id).first();

  let action: "removed" | "updated" | "added" = "added";

  // same reaction → unlike
  if (existing && String((existing as any).type) === type) {
    await env.DB.prepare(
      `DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?`
    ).bind(post_id, user_id).run();

    action = "removed";
  } else {
    // insert or update
    await env.DB.prepare(
      `INSERT INTO post_reactions (post_id, user_id, type)
       VALUES (?, ?, ?)
       ON CONFLICT(post_id, user_id) DO UPDATE SET
         type = excluded.type`
    ).bind(post_id, user_id, type).run();

    action = existing ? "updated" : "added";
  }

  // return server truth for UI
  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) as c FROM post_reactions WHERE post_id = ?`)
    .bind(post_id)
    .first();

  const myRow = await env.DB
    .prepare(`SELECT type FROM post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1`)
    .bind(post_id, user_id)
    .first();

  const reactions_count = Number((countRow as any)?.c ?? 0);
  const my_reaction = (myRow as any)?.type ?? null;

  return Response.json(
    { success: true, action, post_id, user_id, reactions_count, my_reaction },
    { status: 200, headers: cors }
  );
};
