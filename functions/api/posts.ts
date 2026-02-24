// functions/api/posts.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/* ============================================================
   SAFE HELPERS
============================================================ */

const safeString = (v: any) => (typeof v === "string" ? v : "");

const safeNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/* ✅ FIX: handles limit=undefined,null,"" */
const readLimit = (raw: string | null, fallback = 50) => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s || s === "undefined" || s === "null") return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

const isHttpUrl = (v: any) => {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeStringArray = (v: any): string[] => {
  if (Array.isArray(v)) {
    return v.map((x) => String(x || "").trim()).filter(Boolean);
  }

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x || "").trim()).filter(Boolean);
      }
    } catch {}
  }

  return [];
};

const normCreatedAt = (v: any) => {
  const s = String(v ?? "").trim();
  return s || "1970-01-01 00:00:00";
};

/* ============================================================
   OPTIONS
============================================================ */

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

/* ============================================================
   POST /api/posts
============================================================ */

export const onRequestPost: PagesFunction<Env> = async ({
  request,
  env,
}) => {
  try {
    if (!env.DB)
      return json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        500
      );

    const body = await request.json().catch(() => ({}));

    const user_id = safeNumber(body.user_id, 0);
    if (!user_id)
      return json({ error: "Login required (user_id missing)." }, 401);

    const content = safeString(body.content).trim();

    const media_urls_arr = normalizeStringArray(body.media_urls);
    const media_types_arr = normalizeStringArray(body.media_types);

    const filtered_urls = media_urls_arr
      .filter((u) => !String(u).startsWith("data:"))
      .filter((u) => isHttpUrl(u));

    const filtered_types = filtered_urls.map(
      (_, i) => media_types_arr[i] || ""
    );

    const media_url =
      body.media_url ||
      (filtered_urls.length ? filtered_urls[0] : null);

    const media_type =
      body.media_type ||
      (filtered_types.length ? filtered_types[0] : null);

    if (!content && !media_url && filtered_urls.length === 0)
      return json(
        { error: "content or media_url or media_urls required" },
        400
      );

    const media_urls_json =
      filtered_urls.length > 0
        ? JSON.stringify(filtered_urls)
        : null;

    const media_types_json =
      filtered_types.length > 0
        ? JSON.stringify(filtered_types)
        : null;

    const result = await env.DB.prepare(
      `
      INSERT INTO posts
      (user_id,content,media_url,media_type,media_urls,media_types,visibility)
      VALUES(?,?,?,?,?,?,?)
      `
    )
      .bind(
        user_id,
        content || null,
        media_url,
        media_type,
        media_urls_json,
        media_types_json,
        body.visibility || "public"
      )
      .run();

    const post_id = result.meta?.last_row_id;

    return json({
      success: true,
      post_id,
    });
  } catch (err: any) {
    return json(
      { error: "Backend crash", message: String(err?.message) },
      500
    );
  }
};

/* ============================================================
   GET /api/posts
   NON-LOGGED USERS SUPPORTED
============================================================ */

export const onRequestGet: PagesFunction<Env> = async ({
  request,
  env,
}) => {
  try {
    if (!env.DB)
      return json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        500
      );

    const url = new URL(request.url);

    const viewerId = toInt(
      url.searchParams.get("viewerId"),
      0
    );

    const limit = clamp(
      readLimit(url.searchParams.get("limit"), 50),
      1,
      50
    );

    const perType = clamp(limit * 2, 10, 100);

    /* ============================================================
       POSTS
    ============================================================ */

    const posts = await env.DB.prepare(
      `
      SELECT
        'post' AS source,
        'post' AS item_type,

        p.id,
        ('post:'||p.id) AS feed_key,

        p.user_id,
        p.content,
        p.media_url,
        p.media_type,
        p.media_urls,
        p.media_types,
        p.visibility,
        p.created_at,
        p.views,
        p.shares,

        (SELECT COUNT(*) FROM post_reactions WHERE post_id=p.id) AS reactions_count,

        (SELECT type FROM post_reactions
         WHERE post_id=p.id AND user_id=? LIMIT 1)
         AS my_reaction,

        (
          SELECT u.username
          FROM post_reactions pr
          JOIN users u ON u.id=pr.user_id
          WHERE pr.post_id=p.id
          ORDER BY pr.created_at DESC
          LIMIT 1
        ) AS reactor_name,

        u.username,
        u.username AS name,
        u.profile_image_url,
        u.is_verified,
        u.role,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image

      FROM posts p
      LEFT JOIN users u ON u.id=p.user_id

      WHERE p.visibility='public'
      ORDER BY p.created_at DESC
      LIMIT ?
      `
    )
      .bind(viewerId, perType)
      .all();

    /* ============================================================
       REELS
    ============================================================ */

    const reels = await env.DB.prepare(
      `
      SELECT
        'reel' AS source,
        'reel' AS item_type,

        r.id,
        ('reel:'||r.id) AS feed_key,

        r.user_id,
        NULL AS content,
        r.video_url AS media_url,
        'video' AS media_type,
        NULL AS media_urls,
        NULL AS media_types,
        r.visibility,
        r.created_at,
        r.views,
        r.shares,

        (SELECT COUNT(*) FROM reel_likes WHERE reel_id=r.id) reactions_count,

        (SELECT type FROM reel_likes
         WHERE reel_id=r.id AND user_id=? LIMIT 1)
         AS my_reaction,

        NULL reactor_name,

        u.username,
        u.username AS name,
        u.profile_image_url,
        u.is_verified,
        u.role,

        NULL group_id,
        NULL group_name,
        NULL group_image

      FROM reels r
      LEFT JOIN users u ON u.id=r.user_id

      WHERE r.visibility='public'
      ORDER BY r.created_at DESC
      LIMIT ?
      `
    )
      .bind(viewerId, perType)
      .all();

    /* ============================================================
       GROUP POSTS
    ============================================================ */

    const groupPosts = await env.DB.prepare(
      `
      SELECT
        'group_post' AS source,
        'group_post' AS item_type,

        gp.id,
        ('group_post:'||gp.id) AS feed_key,

        gp.user_id,
        gp.content,
        gp.media_url,
        NULL media_type,
        NULL media_urls,
        NULL media_types,
        gp.visibility,
        gp.created_at,
        0 views,
        0 shares,

        (SELECT COUNT(*) FROM group_post_likes
         WHERE group_post_id=gp.id) reactions_count,

        (SELECT 'like'
         FROM group_post_likes
         WHERE group_post_id=gp.id AND user_id=?
         LIMIT 1) my_reaction,

        (
          SELECT u.username
          FROM group_post_likes gpl
          JOIN users u ON u.id=gpl.user_id
          WHERE gpl.group_post_id=gp.id
          ORDER BY gpl.created_at DESC
          LIMIT 1
        ) reactor_name,

        u.username,
        u.username AS name,
        u.profile_image_url,
        u.is_verified,
        u.role,

        gp.group_id,
        g.name group_name,
        g.profile_image group_image

      FROM group_posts gp
      LEFT JOIN users u ON u.id=gp.user_id
      LEFT JOIN groups g ON g.id=gp.group_id

      WHERE gp.visibility='public'
      ORDER BY gp.created_at DESC
      LIMIT ?
      `
    )
      .bind(viewerId, perType)
      .all();

    /* ============================================================
       MERGE
    ============================================================ */

    const items = [
      ...(posts.results || []),
      ...(reels.results || []),
      ...(groupPosts.results || []),
    ];

    const map = new Map();

    for (const it of items) {
      map.set(it.feed_key, it);
    }

    const merged = Array.from(map.values())
      .sort((a, b) =>
        normCreatedAt(b.created_at).localeCompare(
          normCreatedAt(a.created_at)
        )
      )
      .slice(0, limit);

    return json(merged);
  } catch (err: any) {
    return json(
      { error: "Backend crash", message: String(err?.message) },
      500
    );
  }
};
