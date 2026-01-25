//. functions/api/group-post-comments.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server } from "./_cors";

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

// CREATE comment
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const user_id = Number(body.user_id || 0);
    const post_id = Number(body.post_id || 0);
    const parent_comment_id = body.parent_comment_id == null ? null : Number(body.parent_comment_id);
    const text = String(body.text || "").trim();

    if (!user_id || !post_id || !text) return bad("user_id, post_id, text are required");

    // (optional) ensure user is member of the group that owns this post
    const post = await env.DB.prepare(`SELECT group_id FROM group_posts WHERE id=? LIMIT 1`)
      .bind(post_id)
      .first();
    if (!post?.group_id) return bad("Group post not found", 404);

    const mem = await env.DB.prepare(
      `SELECT 1 FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
    )
      .bind(Number(post.group_id), user_id)
      .first();
    if (!mem) return bad("User is not a member of this group", 403);

    await env.DB.prepare(
      `INSERT INTO group_post_comments (user_id, group_post_id, parent_comment_id, text)
       VALUES (?, ?, ?, ?)`
    )
      .bind(user_id, post_id, parent_comment_id, text)
      .run();

    return ok({});
  } catch (e: any) {
    return server(e?.message || "Failed to comment");
  }
};

// LIST comments: /api/group-post-comments?post_id=99
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const post_id = Number(url.searchParams.get("post_id") || 0);
    if (!post_id) return bad("post_id is required");

    const { results } = await env.DB.prepare(
      `SELECT
         c.*,
         u.username,
         u.name,
         u.profile_image_url,
         u.is_verified,
         u.role
       FROM group_post_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.group_post_id = ?
       ORDER BY c.created_at ASC`
    )
      .bind(post_id)
      .all();

    return ok({ comments: results || [] });
  } catch (e: any) {
    return server(e?.message || "Failed to fetch comments");
  }
};
