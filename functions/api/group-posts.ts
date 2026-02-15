// functions/api/group-posts.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server } from "./_cors";

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

// CREATE: POST /api/group-posts
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const group_id = Number(body.group_id || 0);
    const user_id = Number(body.user_id || 0);
    const content = body.content == null ? null : String(body.content);
    const media_url = body.media_url == null ? null : String(body.media_url);

    if (!group_id || !user_id) return bad("group_id and user_id are required");
    if (!content && !media_url) return bad("content or media_url required");

    // ✅ Must be a member to post
    const mem = await env.DB.prepare(
      `SELECT 1 FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
    )
      .bind(group_id, user_id)
      .first();
    if (!mem) return bad("User is not a member of this group", 403);

    const result = await env.DB.prepare(
      `INSERT INTO group_posts (group_id, user_id, content, media_url)
       VALUES (?, ?, ?, ?)`
    )
      .bind(group_id, user_id, content, media_url)
      .run();

    return ok({ success: true, post_id: Number(result.meta.last_row_id) });
  } catch (e: any) {
    return server(e?.message || "Failed to create group post");
  }
};

// LIST:
// - all: /api/group-posts
// - by group: /api/group-posts?group_id=123
// - include viewer: /api/group-posts?group_id=123&viewerId=4  (returns my_reaction='like' if liked)
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const group_id = Number(url.searchParams.get("group_id") || 0);
    const viewerId = Number(url.searchParams.get("viewerId") || 0);

    const where = group_id ? `WHERE gp.group_id = ?` : ``;
    const binds: any[] = [];
    if (group_id) binds.push(group_id);

    // if viewerId provided, compute my_reaction cheaply
    const myLikeSelect = viewerId
      ? `(SELECT CASE WHEN EXISTS(
            SELECT 1 FROM group_post_likes l
            WHERE l.group_post_id = gp.id AND l.user_id = ${viewerId}
          ) THEN 'like' ELSE NULL END) AS my_reaction`
      : `NULL AS my_reaction`;

    const stmt = `
      SELECT
        gp.*,
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role,
        (SELECT COUNT(*) FROM group_post_likes l WHERE l.group_post_id = gp.id) AS reactions_count,
        (SELECT COUNT(*) FROM group_post_comments c WHERE c.group_post_id = gp.id) AS comments_count,
        ${myLikeSelect}
      FROM group_posts gp
      JOIN users u ON u.id = gp.user_id
      ${where}
      ORDER BY gp.created_at DESC
      LIMIT 200
    `;

    const q = env.DB.prepare(stmt);
    const { results } = group_id ? await q.bind(...binds).all() : await q.all();

    return ok({ success: true, posts: results || [] });
  } catch (e: any) {
    return server(e?.message || "Failed to fetch group posts");
  }
};

// EDIT: PUT /api/group-posts?post_id=123   body: { user_id, content }
export const onRequestPut: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const post_id = Number(url.searchParams.get("post_id") || 0);
    if (!post_id) return bad("post_id is required");

    const body = await request.json().catch(() => ({} as any));
    const user_id = Number(body.user_id || 0);
    const content = body.content == null ? "" : String(body.content).trim();

    if (!user_id) return bad("user_id is required");
    if (!content) return bad("content is required");

    const post = await env.DB.prepare(
      `SELECT id, group_id, user_id FROM group_posts WHERE id=? LIMIT 1`
    ).bind(post_id).first();
    if (!post) return bad("Post not found", 404);

    const group_id = Number((post as any).group_id);
    const author_id = Number((post as any).user_id);

    const member = await env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
    ).bind(group_id, user_id).first();

    const isGroupAdmin = String((member as any)?.role || "") === "admin";
    const isAuthor = author_id === user_id;

    if (!isAuthor && !isGroupAdmin) return bad("Not allowed to edit this post", 403);

    await env.DB.prepare(`UPDATE group_posts SET content=? WHERE id=?`)
      .bind(content, post_id)
      .run();

    return ok({ success: true });
  } catch (e: any) {
    return server(e?.message || "Failed to edit group post");
  }
};

// DELETE: DELETE /api/group-posts?post_id=123&user_id=4
export const onRequestDelete: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const post_id = Number(url.searchParams.get("post_id") || 0);
    const user_id = Number(url.searchParams.get("user_id") || 0);

    if (!post_id) return bad("post_id is required");
    if (!user_id) return bad("user_id is required");

    const post = await env.DB.prepare(
      `SELECT id, group_id, user_id FROM group_posts WHERE id=? LIMIT 1`
    ).bind(post_id).first();
    if (!post) return bad("Post not found", 404);

    const group_id = Number((post as any).group_id);
    const author_id = Number((post as any).user_id);

    const member = await env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
    ).bind(group_id, user_id).first();

    const isGroupAdmin = String((member as any)?.role || "") === "admin";
    const isAuthor = author_id === user_id;

    if (!isAuthor && !isGroupAdmin) return bad("Not allowed to delete this post", 403);

    // ✅ CASCADE will delete likes/comments due to FK ON DELETE CASCADE
    await env.DB.prepare(`DELETE FROM group_posts WHERE id=?`).bind(post_id).run();

    return ok({ success: true });
  } catch (e: any) {
    return server(e?.message || "Failed to delete group post");
  }
};
