// functions/api/group-posts.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server } from "./_cors";

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/** -------------------------
 * Helpers
 * -------------------------- */
const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const cleanUrl = (v: any) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s === "null" || s === "undefined") return "";
  return s;
};

const parseMediaUrls = (raw: any): string[] => {
  // Accept:
  // - array: ["a","b"]
  // - json string: '["a","b"]'
  // - comma-separated string: "a,b"
  // - string url: "a" => ["a"]
  // - null => []
  if (Array.isArray(raw)) {
    return raw.map(cleanUrl).filter(Boolean);
  }

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];

    // JSON array string
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.map(cleanUrl).filter(Boolean) : [];
      } catch {
        // fallthrough to treat as single
      }
    }

    // comma-separated
    if (s.includes(",") && !s.includes("://")) {
      // If someone passes "a,b,c" without protocols, still split.
      // But if it contains ://, it's likely URLs; we won't split by comma unless they clearly intended it.
      return s
        .split(",")
        .map((x) => cleanUrl(x))
        .filter(Boolean);
    }

    const one = cleanUrl(s);
    return one ? [one] : [];
  }

  return [];
};

const normalizeImagesForResponse = (row: any): string[] => {
  // Prefer media_urls if present, else fallback to media_url
  const urls = parseMediaUrls(row?.media_urls);
  if (urls.length) return urls;

  const single = cleanUrl(row?.media_url);
  return single ? [single] : [];
};

const isMemberOrAdmin = async (env: any, group_id: number, user_id: number) => {
  // Admins can be allowed globally (users.role='admin'), but your schema may vary.
  // We'll still enforce group membership unless group admin / platform admin logic exists elsewhere.
  const mem = await env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
  )
    .bind(group_id, user_id)
    .first();
  return mem ? { ok: true, role: String((mem as any).role || "") } : { ok: false, role: "" };
};

// CREATE: POST /api/group-posts
// Body accepts:
// { group_id, user_id, content?, media_url?, media_urls? }
// - media_urls can be array OR JSON string.
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    if (!env?.DB) return server("DB binding missing (DB)");

    const body = await request.json().catch(() => ({} as any));

    const group_id = toInt(body.group_id, 0);
    const user_id = toInt(body.user_id, 0);
    const content = body.content == null ? null : String(body.content);

    // Backward compatibility: single media_url
    const media_url = body.media_url == null ? null : cleanUrl(body.media_url);

    // New: media_urls (multiple)
    const media_urls_arr = parseMediaUrls(body.media_urls);
    const media_urls_json = media_urls_arr.length ? JSON.stringify(media_urls_arr) : null;

    if (!group_id || !user_id) return bad("group_id and user_id are required");

    // Must have either content OR some media (single or multiple)
    const hasText = !!String(content ?? "").trim();
    const hasSingle = !!media_url;
    const hasMulti = media_urls_arr.length > 0;

    if (!hasText && !hasSingle && !hasMulti) {
      return bad("content or media_url or media_urls required");
    }

    // Must be a member to post
    const mem = await isMemberOrAdmin(env, group_id, user_id);
    if (!mem.ok) return bad("User is not a member of this group", 403);

    const result = await env.DB.prepare(
      `INSERT INTO group_posts (group_id, user_id, content, media_url, media_urls)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(group_id, user_id, content, media_url, media_urls_json)
      .run();

    return ok({
      success: true,
      post_id: Number(result.meta.last_row_id),
      media_urls: media_urls_arr, // helpful to client
    });
  } catch (e: any) {
    return server(e?.message || "Failed to create group post");
  }
};

// LIST:
// - all: /api/group-posts
// - by group: /api/group-posts?group_id=123
// - include viewer: /api/group-posts?group_id=123&viewerId=4
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    if (!env?.DB) return server("DB binding missing (DB)");

    const url = new URL(request.url);
    const group_id = toInt(url.searchParams.get("group_id"), 0);
    const viewerId = toInt(url.searchParams.get("viewerId"), 0);

    const where = group_id ? `WHERE gp.group_id = ?` : ``;
    const binds: any[] = [];
    if (group_id) binds.push(group_id);

    // NOTE: viewerId is a number after toInt(). Interpolating is OK here,
    // but we can also bind it. This subquery form is okay for D1.
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

    // Add normalized arrays so frontend can render multi-images easily
    const posts = (results || []).map((r: any) => {
      const images = normalizeImagesForResponse(r);
      return {
        ...r,
        // ✅ consistent multi-image arrays
        images, // always array
        media_urls: images, // alias to make UI easier
      };
    });

    return ok({ success: true, posts });
  } catch (e: any) {
    return server(e?.message || "Failed to fetch group posts");
  }
};

// EDIT: PUT /api/group-posts?post_id=123
// body: { user_id, content?, media_url?, media_urls? }
export const onRequestPut: PagesFunction = async ({ request, env }) => {
  try {
    if (!env?.DB) return server("DB binding missing (DB)");

    const url = new URL(request.url);
    const post_id = toInt(url.searchParams.get("post_id"), 0);
    if (!post_id) return bad("post_id is required");

    const body = await request.json().catch(() => ({} as any));
    const user_id = toInt(body.user_id, 0);
    if (!user_id) return bad("user_id is required");

    const post = await env.DB.prepare(
      `SELECT id, group_id, user_id FROM group_posts WHERE id=? LIMIT 1`
    )
      .bind(post_id)
      .first();
    if (!post) return bad("Post not found", 404);

    const group_id = toInt((post as any).group_id, 0);
    const author_id = toInt((post as any).user_id, 0);

    const member = await env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
    )
      .bind(group_id, user_id)
      .first();

    const isGroupAdmin = String((member as any)?.role || "") === "admin";
    const isAuthor = author_id === user_id;
    if (!isAuthor && !isGroupAdmin) return bad("Not allowed to edit this post", 403);

    // Optional updates
    const content = body.content == null ? null : String(body.content).trim();
    const media_url = body.media_url == null ? null : cleanUrl(body.media_url);

    const media_urls_arr =
      body.media_urls == null ? null : parseMediaUrls(body.media_urls);
    const media_urls_json =
      media_urls_arr && media_urls_arr.length ? JSON.stringify(media_urls_arr) : null;

    // Build dynamic update
    const sets: string[] = [];
    const binds: any[] = [];

    if (body.content !== undefined) {
      sets.push(`content=?`);
      binds.push(content);
    }
    if (body.media_url !== undefined) {
      sets.push(`media_url=?`);
      binds.push(media_url);
    }
    if (body.media_urls !== undefined) {
      sets.push(`media_urls=?`);
      binds.push(media_urls_json);
    }

    if (sets.length === 0) return bad("Nothing to update");

    // Prevent clearing everything in a single update (if they set all to empty)
    const willClearText = body.content !== undefined && !String(content ?? "").trim();
    const willClearSingle = body.media_url !== undefined && !media_url;
    const willClearMulti = body.media_urls !== undefined && !(media_urls_arr?.length);

    if (willClearText && willClearSingle && willClearMulti) {
      return bad("content or media_url or media_urls required");
    }

    const sql = `UPDATE group_posts SET ${sets.join(", ")} WHERE id=?`;
    binds.push(post_id);

    await env.DB.prepare(sql).bind(...binds).run();

    return ok({ success: true });
  } catch (e: any) {
    return server(e?.message || "Failed to edit group post");
  }
};

// DELETE: DELETE /api/group-posts?post_id=123&user_id=4
export const onRequestDelete: PagesFunction = async ({ request, env }) => {
  try {
    if (!env?.DB) return server("DB binding missing (DB)");

    const url = new URL(request.url);
    const post_id = toInt(url.searchParams.get("post_id"), 0);
    const user_id = toInt(url.searchParams.get("user_id"), 0);

    if (!post_id) return bad("post_id is required");
    if (!user_id) return bad("user_id is required");

    const post = await env.DB.prepare(
      `SELECT id, group_id, user_id FROM group_posts WHERE id=? LIMIT 1`
    )
      .bind(post_id)
      .first();
    if (!post) return bad("Post not found", 404);

    const group_id = toInt((post as any).group_id, 0);
    const author_id = toInt((post as any).user_id, 0);

    const member = await env.DB.prepare(
      `SELECT role FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
    )
      .bind(group_id, user_id)
      .first();

    const isGroupAdmin = String((member as any)?.role || "") === "admin";
    const isAuthor = author_id === user_id;

    if (!isAuthor && !isGroupAdmin) return bad("Not allowed to delete this post", 403);

    await env.DB.prepare(`DELETE FROM group_posts WHERE id=?`).bind(post_id).run();

    return ok({ success: true });
  } catch (e: any) {
    return server(e?.message || "Failed to delete group post");
  }
};
