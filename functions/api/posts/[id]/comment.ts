// functions/api/posts/[id]/comment.ts
import type { PagesFunction } from "@cloudflare/workers-types";
type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const toIntOrNull = (v: any) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // block temp ids like "tmp-123"
  if (s.startsWith("tmp-")) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const postId = Number((params as any)?.id);
    if (!Number.isFinite(postId) || postId <= 0) {
      return json({ error: "Invalid post id" }, 400);
    }

    const body = await request.json().catch(() => ({} as any));

    const text = String(body.text ?? "").trim();
    const userId = Number(body.user_id);

    // ✅ NEW: parent id support (reply)
    const parentCommentId = toIntOrNull(body.parent_comment_id);

    if (!text) return json({ error: "text is required" }, 400);
    if (!Number.isFinite(userId) || userId <= 0) return json({ error: "user_id is required" }, 400);

    // ✅ Optional safety: if a parent is provided, ensure it belongs to same post
    if (parentCommentId) {
      const parent = await env.DB.prepare(
        `SELECT id, post_id FROM post_comments WHERE id = ? LIMIT 1`
      ).bind(parentCommentId).first();

      if (!parent) return json({ error: "Parent comment not found" }, 400);
      if (Number((parent as any).post_id) !== postId) {
        return json({ error: "Parent comment does not belong to this post" }, 400);
      }
    }

    // ✅ insert WITH parent_comment_id
    const insert = await env.DB.prepare(
      `INSERT INTO post_comments (post_id, user_id, text, parent_comment_id)
       VALUES (?, ?, ?, ?)`
    )
      .bind(postId, userId, text, parentCommentId)
      .run();

    const insertedId = Number(insert.meta?.last_row_id);
    if (!Number.isFinite(insertedId) || insertedId <= 0) {
      return json({ error: "Failed to create comment" }, 500);
    }

    // ✅ return full comment including parent_comment_id
    const comment = await env.DB.prepare(
      `SELECT pc.id, pc.post_id, pc.user_id, pc.text, pc.created_at, pc.parent_comment_id,
              u.username as author_name, u.profile_image_url as author_image
       FROM post_comments pc
       LEFT JOIN users u ON u.id = pc.user_id
       WHERE pc.id = ?`
    )
      .bind(insertedId)
      .first();

    return json({ success: true, comment: comment ?? null }, 201);
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};
