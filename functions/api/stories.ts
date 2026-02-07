// functions/api/stories.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toStr = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));

    const user_id = toInt(body.user_id, 0);
    const type = toStr(body.type, "").trim();

    const media_url = body.media_url ? toStr(body.media_url).trim() : null;
    const text_content = body.text_content ? toStr(body.text_content).trim() : null;
    const background_style = body.background_style ? toStr(body.background_style).trim() : null;

    const music_url = body.music_url ? toStr(body.music_url).trim() : null;
    const music_title = body.music_title ? toStr(body.music_title).trim() : null;

    // client can send, but we also safely default
    const expires_at_raw = typeof body.expires_at === "string" ? body.expires_at.trim() : "";

    if (!user_id) return json({ success: false, error: "user_id is required" }, 400);

    // ✅ UPDATED: allow video
    if (type !== "text" && type !== "image" && type !== "video") {
      return json({ success: false, error: "type must be text, image, or video" }, 400);
    }

    // Validation
    if (type === "text" && !text_content)
      return json({ success: false, error: "text_content is required" }, 400);

    if ((type === "image" || type === "video") && !media_url)
      return json({ success: false, error: "media_url is required" }, 400);

    // ✅ Default expires_at = now + 24h if missing
    const expiresExpr = expires_at_raw ? "?" : "datetime('now','+24 hours')";

    // ✅ IMPORTANT: Keep INSERT columns EXACTLY matching your current DB table
    const stmt = `
      INSERT INTO stories
      (user_id, type, media_url, text_content, background_style, music_url, music_title, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ${expiresExpr})
    `;

    const bindArgs = expires_at_raw
      ? [user_id, type, media_url, text_content, background_style, music_url, music_title, expires_at_raw]
      : [user_id, type, media_url, text_content, background_style, music_url, music_title];

    const result = await env.DB.prepare(stmt).bind(...bindArgs).run();
    const story_id = Number(result.meta?.last_row_id);

    // return full story with author fields
    const story = await env.DB.prepare(
      `
      SELECT
        s.*,
        u.username as author_name,
        u.profile_image_url as author_image
      FROM stories s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
      LIMIT 1
    `
    )
      .bind(story_id)
      .first();

    return json({ success: true, story }, 201);
  } catch (err: any) {
    return json({ success: false, error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const url = new URL(request.url);
    const viewerId = toInt(url.searchParams.get("viewerId"), 0);

    const q = `
      SELECT
        s.*,
        u.username as author_name,
        u.profile_image_url as author_image,

        (SELECT COUNT(*) FROM story_reactions sr WHERE sr.story_id = s.id) AS likes_count,

        (SELECT 1
           FROM story_reactions sr
          WHERE sr.story_id = s.id
            AND sr.user_id = ?
          LIMIT 1
        ) AS liked_by_me

      FROM stories s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.expires_at > datetime('now')
      ORDER BY s.created_at DESC
      LIMIT 500
    `;

    const { results } = await env.DB.prepare(q).bind(viewerId || 0).all();
    return json(Array.isArray(results) ? results : []);
  } catch (err: any) {
    return json({ success: false, error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};
