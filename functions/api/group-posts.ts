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

    // comma-separated (safe-ish)
    if (s.includes(",") && !s.includes("://")) {
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
  const urls = parseMediaUrls(row?.media_urls);
  if (urls.length) return urls;

  const single = cleanUrl(row?.media_url);
  return single ? [single] : [];
};

const isMemberOrAdmin = async (env: any, group_id: number, user_id: number) => {
  const mem = await env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
  )
    .bind(group_id, user_id)
    .first();
  return mem ? { ok: true, role: String((mem as any).role || "") } : { ok: false, role: "" };
};

// CREATE: POST /api/group-posts
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    if (!env?.DB) return server("DB binding missing (DB)");

    const body = await request.json().catch(() => ({} as any));

    const group_id = toInt(body.group_id, 0);
    const user_id = toInt(body.user_id, 0);
    const content = body.content == null ? null : String(body.content);

    const media_url = body.media_url == null ? null : cleanUrl(body.media_url);

    const media_urls_arr = parseMediaUrls(body.media_urls);
    const media_urls_json = media_urls_arr.length ? JSON.stringify(media_urls_arr) : null;

    if (!group_id || !user_id) return bad("group_id and user_id are required");

    const hasText = !!String(content ?? "").trim();
    const hasSingle = !!media_url;
    const hasMulti = media_urls_arr.length > 0;

    if (!hasText && !hasSingle && !hasMulti) {
      return bad("content or media_url or media_urls required");
    }

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
      media_urls: media_urls_arr,
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

    // ✅ UPDATED: likes -> reactions
    const myReactionSelect = viewerId
      ? `(SELECT LOWER(COALESCE(r.type,'like'))
          FROM group_post_reactions r
          WHERE r.group_post_id = gp.id AND r.user_id = ${viewerId}
          LIMIT 1
        ) AS my_reaction`
      : `NULL AS my_reaction`;

    // ✅ UPDATED: counts + preview + by_type like posts table
    const stmt = `
      SELECT
        gp.*,
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role,

        (SELECT COUNT(*) FROM group_post_reactions r WHERE r.group_post_id = gp.id) AS reactions_count,
        (SELECT COUNT(*) FROM group_post_comments c WHERE c.group_post_id = gp.id) AS comments_count,

        ${myReactionSelect},

        (
          SELECT COALESCE(u2.name, u2.username, '')
          FROM group_post_reactions r2
          JOIN users u2 ON u2.id = r2.user_id
          WHERE r2.group_post_id = gp.id
          ORDER BY r2.created_at DESC, r2.id DESC
          LIMIT 1
        ) AS reactor_name,

        (
          SELECT json_group_array(
            json_object(
              'user_id', x.user_id,
              'type', x.type,
              'name', x.name,
              'profile_image_url', x.profile_image_url
            )
          )
          FROM (
            SELECT
              r3.user_id AS user_id,
              LOWER(COALESCE(r3.type,'like')) AS type,
              COALESCE(u3.name, u3.username, '') AS name,
              CASE
                WHEN u3.profile_image_url LIKE 'data:%' THEN NULL
                WHEN length(u3.profile_image_url) > 300 THEN NULL
                ELSE u3.profile_image_url
              END AS profile_image_url
            FROM group_post_reactions r3
            LEFT JOIN users u3 ON u3.id = r3.user_id
            WHERE r3.group_post_id = gp.id
            ORDER BY r3.created_at DESC, r3.id DESC
            LIMIT 30
          ) x
        ) AS reactions_preview,

        (
          SELECT json_group_array(
            json_object('type', t.type, 'count', t.c)
          )
          FROM (
            SELECT LOWER(COALESCE(type,'like')) AS type, COUNT(*) AS c
            FROM group_post_reactions
            WHERE group_post_id = gp.id
            GROUP BY LOWER(COALESCE(type,'like'))
            ORDER BY c DESC
          ) t
        ) AS reactions_by_type

      FROM group_posts gp
      JOIN users u ON u.id = gp.user_id
      ${where}
      ORDER BY gp.created_at DESC
      LIMIT 200
    `;

    const q = env.DB.prepare(stmt);
    const { results } = group_id ? await q.bind(...binds).all() : await q.all();

    const posts = (results || []).map((r: any) => {
      const images = normalizeImagesForResponse(r);
      return {
        ...r,
        images,
        // ✅ keep raw DB column too, but provide array alias for UI
        media_urls: images,
      };
    });

    return ok({ success: true, posts });
  } catch (e: any) {
    return server(e?.message || "Failed to fetch group posts");
  }
};

// EDIT: PUT /api/group-posts?post_id=123
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

    const content = body.content == null ? null : String(body.content).trim();
    const media_url = body.media_url == null ? null : cleanUrl(body.media_url);

    const media_urls_arr = body.media_urls == null ? null : parseMediaUrls(body.media_urls);
    const media_urls_json = media_urls_arr && media_urls_arr.length ? JSON.stringify(media_urls_arr) : null;

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
