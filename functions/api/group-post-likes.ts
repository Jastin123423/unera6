let us modify  backend  the frontend  already  support 
//. functions/api/group-post-likes.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server } from "./_cors";

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const user_id = Number(body.user_id || 0);
    const post_id = Number(body.post_id || 0);

    if (!user_id || !post_id) return bad("user_id and post_id are required");

    // Ensure post exists + get group_id
    const post = await env.DB.prepare(`SELECT group_id FROM group_posts WHERE id=? LIMIT 1`)
      .bind(post_id)
      .first();
    if (!post?.group_id) return bad("Group post not found", 404);

    // Must be a member
    const mem = await env.DB.prepare(
      `SELECT 1 FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
    )
      .bind(Number(post.group_id), user_id)
      .first();
    if (!mem) return bad("User is not a member of this group", 403);

    // Toggle
    const existing = await env.DB.prepare(
      `SELECT id FROM group_post_likes WHERE user_id=? AND group_post_id=? LIMIT 1`
    )
      .bind(user_id, post_id)
      .first();

    if (existing?.id) {
      await env.DB.prepare(`DELETE FROM group_post_likes WHERE id=?`).bind(existing.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO group_post_likes (user_id, group_post_id) VALUES (?, ?)`
      )
        .bind(user_id, post_id)
        .run();
    }

    const row = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM group_post_likes WHERE group_post_id=?`
    )
      .bind(post_id)
      .first();

    return ok({
      liked: !existing?.id,
      likes_count: Number(row?.c || 0),
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("UNIQUE")) {
      // should not happen because we toggle, but safe:
      return ok({ liked: true });
    }
    return server(msg || "Failed to toggle like");
  }
};
