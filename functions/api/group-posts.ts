// functions/api/group-posts.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server } from "./_cors";

type Env = { DB: D1Database };

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/** -------------------------
 * Helpers
 * -------------------------- */
const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toNumOrNull = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const safeStr = (v: any) => {
  const s = String(v ?? "").trim();
  return s === "null" || s === "undefined" ? "" : s;
};

const cleanUrl = (v: any) => {
  const s = safeStr(v);
  return s;
};

const parseMediaUrls = (raw: any): string[] => {
  // Accept:
  // - array: ["a","b"]
  // - json string: '["a","b"]'
  // - comma-separated string: "a,b"
  // - string url: "a" => ["a"]
  // - null => []
  if (Array.isArray(raw)) return raw.map(cleanUrl).filter(Boolean);

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];

    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed.map(cleanUrl).filter(Boolean) : [];
      } catch {
        // fallthrough
      }
    }

    if (s.includes(",") && !s.includes("://")) {
      return s.split(",").map((x) => cleanUrl(x)).filter(Boolean);
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

const normalizeCategory = (v: any) => {
  const key = safeStr(v).toLowerCase();
  // keep your real categories here
  if (key === "buy_sell" || key === "buysell" || key === "buy-sell") return "buy_sell";
  if (key === "recruitment" || key === "jobs" || key === "job") return "recruitment";
  return key || "general";
};

const normalizeVisibility = (v: any) => {
  const s = safeStr(v).toLowerCase();
  return s === "private" ? "private" : "public";
};

const normalizeApplicationType = (v: any) => {
  const t = safeStr(v).toLowerCase();
  return t === "email" || t === "link" ? t : "";
};

const normalizeStatus = (v: any) => {
  const s = safeStr(v).toLowerCase();
  return s === "sold" || s === "pending" || s === "available" ? s : "available";
};

const isMemberOrAdmin = async (env: any, group_id: number, user_id: number) => {
  const mem = await env.DB.prepare(
    `SELECT role FROM group_members WHERE group_id=? AND user_id=? LIMIT 1`
  )
    .bind(group_id, user_id)
    .first();
  return mem ? { ok: true, role: String((mem as any).role || "") } : { ok: false, role: "" };
};

const getGroupCategory = async (env: any, group_id: number) => {
  const g = await env.DB.prepare(`SELECT id, category FROM groups WHERE id=? LIMIT 1`)
    .bind(group_id)
    .first();
  if (!g) return { ok: false as const, category: "general" };
  return { ok: true as const, category: normalizeCategory((g as any).category) };
};

/** ============================================================
 * CREATE: POST /api/group-posts
 * Supports:
 * - media_url, media_urls
 * - recruitment fields
 * - buy_sell fields
 * You can send category fields directly or inside body.metadata
 * ============================================================ */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env?.DB) return server("DB binding missing (DB)");

    const body = await request.json().catch(() => ({} as any));

    const group_id = toInt(body.group_id, 0);
    const user_id = toInt(body.user_id, 0);

    const content = body.content == null ? null : String(body.content);

    const media_url = body.media_url == null ? null : cleanUrl(body.media_url);

    const media_urls_arr = parseMediaUrls(body.media_urls);
    const media_urls_json = media_urls_arr.length ? JSON.stringify(media_urls_arr) : null;

    const visibility = normalizeVisibility(body.visibility);

    if (!group_id || !user_id) return bad("group_id and user_id are required");

    const hasText = !!safeStr(content ?? "");
    const hasSingle = !!media_url;
    const hasMulti = media_urls_arr.length > 0;

    if (!hasText && !hasSingle && !hasMulti) {
      return bad("content or media_url or media_urls required");
    }

    const mem = await isMemberOrAdmin(env, group_id, user_id);
    if (!mem.ok) return bad("User is not a member of this group", 403);

    // ✅ Read group category (so we know rules)
    const catRes = await getGroupCategory(env, group_id);
    if (!catRes.ok) return bad("Group not found", 404);
    const groupCategory = catRes.category;

    // metadata support
    const meta = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    // =========================
    // Recruitment fields
    // =========================
    const job_title = safeStr(meta.job_title ?? body.job_title);
    const company = safeStr(meta.company ?? body.company);
    const job_type = safeStr(meta.job_type ?? body.job_type);
    const salary = safeStr(meta.salary ?? body.salary);

    const street = safeStr(meta.street ?? body.street);
    const district = safeStr(meta.district ?? body.district);
    const region = safeStr(meta.region ?? body.region);
    const country = safeStr(meta.country ?? body.country);
    const location = safeStr(meta.location ?? body.location);

    const application_type = normalizeApplicationType(meta.application_type ?? body.application_type);
    const application_value = safeStr(meta.application_value ?? body.application_value);
    const expiry_date = safeStr(meta.expiry_date ?? body.expiry_date); // store ISO string

    // =========================
    // Buy/Sell fields
    // =========================
    const price = toNumOrNull(meta.price ?? body.price);
    const currency = safeStr(meta.currency ?? body.currency) || "USD";
    const condition = safeStr(meta.condition ?? body.condition);
    const status = normalizeStatus(meta.status ?? body.status);

    // ✅ Category-based validation (recommended)
    if (groupCategory === "recruitment") {
      if (!job_title) return bad("job_title is required for recruitment posts");
      if (application_type && !application_value) {
        return bad("application_value is required when application_type is set");
      }
    }

    if (groupCategory === "buy_sell") {
      if (price === null) return bad("price is required for buy_sell posts");
      if (!condition) return bad("condition is required for buy_sell posts");
    }

    // Insert with new columns (safe even if they are null)
    const result = await env.DB.prepare(
      `INSERT INTO group_posts (
        group_id, user_id, content, media_url, media_urls, visibility,

        job_title, company, job_type, salary,
        street, district, region, country, location,
        application_type, application_value, expiry_date,

        price, currency, condition, status
      )
      VALUES (?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?, ?)`
    )
      .bind(
        group_id,
        user_id,
        content,
        media_url,
        media_urls_json,
        visibility,

        job_title || null,
        company || null,
        job_type || null,
        salary || null,

        street || null,
        district || null,
        region || null,
        country || null,
        location || null,

        application_type || null,
        application_value || null,
        expiry_date || null,

        price,
        currency,
        condition || null,
        status
      )
      .run();

    return ok({
      success: true,
      post_id: Number(result.meta.last_row_id),
      media_urls: media_urls_arr,
      group_category: groupCategory,
    });
  } catch (e: any) {
    return server(e?.message || "Failed to create group post");
  }
};

/** ============================================================
 * LIST:
 * - all: /api/group-posts
 * - by group: /api/group-posts?group_id=123
 * - include viewer: /api/group-posts?group_id=123&viewerId=4
 * ============================================================ */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env?.DB) return server("DB binding missing (DB)");

    const url = new URL(request.url);
    const group_id = toInt(url.searchParams.get("group_id"), 0);
    const viewerId = toInt(url.searchParams.get("viewerId"), 0);

    const where = group_id ? `WHERE gp.group_id = ?` : ``;
    const binds: any[] = [];
    if (group_id) binds.push(group_id);

    const myReactionSelect = viewerId
      ? `(SELECT LOWER(COALESCE(r.type,'like'))
          FROM group_post_reactions r
          WHERE r.group_post_id = gp.id AND r.user_id = ${viewerId}
          LIMIT 1
        ) AS my_reaction`
      : `NULL AS my_reaction`;

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
        media_urls: images, // UI alias
      };
    });

    return ok({ success: true, posts });
  } catch (e: any) {
    return server(e?.message || "Failed to fetch group posts");
  }
};

/** ============================================================
 * EDIT: PUT /api/group-posts?post_id=123
 * Supports updating new category fields too
 * ============================================================ */
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
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

    // metadata support
    const meta = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    const content = body.content == null ? null : String(body.content).trim();
    const media_url = body.media_url == null ? null : cleanUrl(body.media_url);

    const media_urls_arr = body.media_urls == null ? null : parseMediaUrls(body.media_urls);
    const media_urls_json =
      media_urls_arr && media_urls_arr.length ? JSON.stringify(media_urls_arr) : null;

    const visibility = body.visibility !== undefined ? normalizeVisibility(body.visibility) : undefined;

    const sets: string[] = [];
    const binds: any[] = [];

    const setIf = (key: string, val: any) => {
      sets.push(`${key}=?`);
      binds.push(val);
    };

    if (body.content !== undefined) setIf("content", content);
    if (body.media_url !== undefined) setIf("media_url", media_url);
    if (body.media_urls !== undefined) setIf("media_urls", media_urls_json);
    if (visibility !== undefined) setIf("visibility", visibility);

    // New fields (direct or metadata)
    const fieldMap: Array<[string, any]> = [
      ["job_title", safeStr(meta.job_title ?? body.job_title) || null],
      ["company", safeStr(meta.company ?? body.company) || null],
      ["job_type", safeStr(meta.job_type ?? body.job_type) || null],
      ["salary", safeStr(meta.salary ?? body.salary) || null],

      ["street", safeStr(meta.street ?? body.street) || null],
      ["district", safeStr(meta.district ?? body.district) || null],
      ["region", safeStr(meta.region ?? body.region) || null],
      ["country", safeStr(meta.country ?? body.country) || null],
      ["location", safeStr(meta.location ?? body.location) || null],

      ["application_type", normalizeApplicationType(meta.application_type ?? body.application_type) || null],
      ["application_value", safeStr(meta.application_value ?? body.application_value) || null],
      ["expiry_date", safeStr(meta.expiry_date ?? body.expiry_date) || null],

      ["price", body.price !== undefined || meta.price !== undefined ? toNumOrNull(meta.price ?? body.price) : undefined],
      ["currency", body.currency !== undefined || meta.currency !== undefined ? (safeStr(meta.currency ?? body.currency) || "USD") : undefined],
      ["condition", body.condition !== undefined || meta.condition !== undefined ? (safeStr(meta.condition ?? body.condition) || null) : undefined],
      ["status", body.status !== undefined || meta.status !== undefined ? normalizeStatus(meta.status ?? body.status) : undefined],
    ];

    for (const [col, val] of fieldMap) {
      if (val !== undefined) setIf(col, val);
    }

    if (sets.length === 0) return bad("Nothing to update");

    // Keep your safety check for clearing everything
    const willClearText = body.content !== undefined && !safeStr(content ?? "");
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

/** ============================================================
 * DELETE: DELETE /api/group-posts?post_id=123&user_id=4
 * ============================================================ */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
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
