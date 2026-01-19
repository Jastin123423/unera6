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

    // Existing reaction?
    const existing = await env.DB.prepare(
      `SELECT type FROM post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1`
    ).bind(post_id, user_id).first();

    let action: "added" | "updated" | "removed" = "added";

    // Same reaction => toggle off (remove)
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

    // ✅ Return authoritative values for UI sync (homepage + profile)
    const row = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = ?) AS reactions_count,
         (SELECT pr.type FROM post_reactions pr WHERE pr.post_id = ? AND pr.user_id = ? LIMIT 1) AS my_reaction`
    ).bind(post_id, post_id, user_id).first();

    return json({
      success: true,
      action,
      post_id,
      user_id,
      reactions_count: Number((row as any)?.reactions_count ?? 0),
      my_reaction: (row as any)?.my_reaction ?? null,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || String(e) }, 500);
  }
};
