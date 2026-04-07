import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toStr = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const storyId = toInt(params.id, 0);
    if (!storyId) return json({ success: false, error: "Invalid story id" }, 400);

    const { results } = await env.DB.prepare(
      `
      SELECT
        sc.id,
        sc.story_id,
        sc.user_id,
        sc.parent_id,
        sc.content,
        sc.created_at,
        sc.updated_at,
        u.name,
        u.username,
        u.profile_image_url,
        u.role,
        u.is_verified
      FROM story_comments sc
      LEFT JOIN users u ON u.id = sc.user_id
      WHERE sc.story_id = ?
        AND sc.is_deleted = 0
      ORDER BY sc.created_at ASC
      `
    ).bind(storyId).all();

    return json({ success: true, comments: Array.isArray(results) ? results : [] });
  } catch (err: any) {
    return json(
      { success: false, error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const storyId = toInt(params.id, 0);
    const body = await request.json().catch(() => ({} as any));

    const userId = toInt(body.user_id, 0);
    const parentId = body.parent_id == null ? null : toInt(body.parent_id, 0);
    const content = toStr(body.content, "").trim();

    if (!storyId) return json({ success: false, error: "Invalid story id" }, 400);
    if (!userId) return json({ success: false, error: "user_id is required" }, 400);
    if (!content) return json({ success: false, error: "content is required" }, 400);

    const result = await env.DB.prepare(
      `
      INSERT INTO story_comments (story_id, user_id, parent_id, content)
      VALUES (?, ?, ?, ?)
      `
    ).bind(storyId, userId, parentId, content).run();

    const commentId = Number(result.meta?.last_row_id || 0);

    const comment = await env.DB.prepare(
      `
      SELECT
        sc.id,
        sc.story_id,
        sc.user_id,
        sc.parent_id,
        sc.content,
        sc.created_at,
        sc.updated_at,
        u.name,
        u.username,
        u.profile_image_url,
        u.role,
        u.is_verified
      FROM story_comments sc
      LEFT JOIN users u ON u.id = sc.user_id
      WHERE sc.id = ?
      LIMIT 1
      `
    ).bind(commentId).first();

    return json({ success: true, comment }, 201);
  } catch (err: any) {
    return json(
      { success: false, error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const storyId = toInt(params.id, 0);
    const body = await request.json().catch(() => ({} as any));

    const commentId = toInt(body.comment_id, 0);
    const userId = toInt(body.user_id, 0);
    const content = toStr(body.content, "").trim();

    if (!storyId) return json({ success: false, error: "Invalid story id" }, 400);
    if (!commentId) return json({ success: false, error: "comment_id is required" }, 400);
    if (!userId) return json({ success: false, error: "user_id is required" }, 400);
    if (!content) return json({ success: false, error: "content is required" }, 400);

    const existing = await env.DB.prepare(
      `SELECT id, user_id FROM story_comments WHERE id = ? AND story_id = ? LIMIT 1`
    ).bind(commentId, storyId).first();

    if (!existing) return json({ success: false, error: "Comment not found" }, 404);
    if (Number((existing as any).user_id) !== userId) {
      return json({ success: false, error: "Not allowed" }, 403);
    }

    await env.DB.prepare(
      `
      UPDATE story_comments
      SET content = ?, updated_at = datetime('now')
      WHERE id = ? AND story_id = ?
      `
    ).bind(content, commentId, storyId).run();

    return json({ success: true });
  } catch (err: any) {
    return json(
      { success: false, error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const storyId = toInt(params.id, 0);
    const body = await request.json().catch(() => ({} as any));

    const commentId = toInt(body.comment_id, 0);
    const userId = toInt(body.user_id, 0);

    if (!storyId) return json({ success: false, error: "Invalid story id" }, 400);
    if (!commentId) return json({ success: false, error: "comment_id is required" }, 400);
    if (!userId) return json({ success: false, error: "user_id is required" }, 400);

    const existing = await env.DB.prepare(
      `SELECT id, user_id FROM story_comments WHERE id = ? AND story_id = ? LIMIT 1`
    ).bind(commentId, storyId).first();

    if (!existing) return json({ success: false, error: "Comment not found" }, 404);
    if (Number((existing as any).user_id) !== userId) {
      return json({ success: false, error: "Not allowed" }, 403);
    }

    await env.DB.prepare(
      `
      UPDATE story_comments
      SET is_deleted = 1, updated_at = datetime('now')
      WHERE id = ? AND story_id = ?
      `
    ).bind(commentId, storyId).run();

    return json({ success: true });
  } catch (err: any) {
    return json(
      { success: false, error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};
