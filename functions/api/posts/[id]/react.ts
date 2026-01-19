import type { PagesFunction } from '@cloudflare/workers-types';

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

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const post_id = Number((params as any)?.id);
    if (!post_id) return json({ success: false, error: "Invalid post id" }, 400);

    const body = await request.json().catch(() => ({} as any));
    const user_id = Number(body.user_id ?? 0);
    const type = String(body.type || "like").trim();

    if (!user_id) return json({ success: false, error: "user_id is required" }, 400);
    if (!type) return json({ success: false, error: "type is required" }, 400);

    // 1) Existing reaction?
    const existing = await env.DB.prepare(
      `SELECT type FROM post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1`
    ).bind(post_id, user_id).first();

    let action: "added" | "updated" | "removed" = "added";

    // 2) Toggle logic
    if (existing && String((existing as any).type) === type) {
      await env.DB.prepare(
        `DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?`
      ).bind(post_id, user_id).run();

      action = "removed";
    } else {
      // Upsert
      await env.DB.prepare(
        `INSERT INTO post_reactions (post_id, user_id, type)
         VALUES (?, ?, ?)
         ON CONFLICT(post_id, user_id) DO UPDATE SET
           type = excluded.type`
      ).bind(post_id, user_id, type).run();

      action = existing ? "updated" : "added";
    }

    // 3) Authoritative values (use separate queries = safest in D1)
    const countRow = await env.DB
      .prepare(`SELECT COUNT(*) AS c FROM post_reactions WHERE post_id = ?`)
      .bind(post_id)
      .first();

    const myRow = await env.DB
      .prepare(`SELECT type FROM post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1`)
      .bind(post_id, user_id)
      .first();

    return json({
      success: true,
      action,
      post_id,
      user_id,
      reactions_count: Number((countRow as any)?.c ?? 0),
      my_reaction: (myRow as any)?.type ?? null,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
