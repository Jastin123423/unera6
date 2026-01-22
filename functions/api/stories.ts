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
    const body = await request.json().catch(() => ({} as any));

    const user_id = toInt(body.user_id, 0);
    const type = toStr(body.type, "image"); // "text" | "image"
    const media_url = body.media_url ? toStr(body.media_url) : null;
    const text_content = body.text_content ? toStr(body.text_content) : null;
    const background_style = body.background_style ? toStr(body.background_style) : null;
    const music_url = body.music_url ? toStr(body.music_url) : null;
    const music_title = body.music_title ? toStr(body.music_title) : null;

    // ✅ default expires_at to +24h
    const expires_at =
      typeof body.expires_at === "string" && body.expires_at.trim()
        ? body.expires_at.trim()
        : null;

    if (!user_id) return json({ error: "user_id is required" }, 400);

    // ✅ basic validation
    if (type === "text") {
      if (!text_content) return json({ error: "text_content is required for text stories" }, 400);
    } else {
      if (!media_url) return json({ error: "media_url is required for image stories" }, 400);
    }

    const insert = await env.DB.prepare(
      `
      INSERT INTO stories
      (user_id, type, media_url, text_content, background_style, music_url, music_title, expires_at)
      VALUES
      (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now','+24 hours')))
    `
    )
      .bind(
        user_id,
        type,
        media_url,
        text_content,
        background_style,
        music_url,
        music_title,
        expires_at
      )
      .run();

    const story_id = Number(insert.meta?.last_row_id);
    if (!story_id) return json({ error: "Failed to create story" }, 500);

    // ✅ return full story + author fields for instant UI
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

    return json({ success: true, story: story ?? null }, 201);
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const viewerId = toInt(url.searchParams.get("viewerId"), 0);

    // ✅ show only active stories (not expired)
    // ✅ order by newest first (like your reel UI expects)
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
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};
