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

    if (!user_id) return json({ success: false, error: "user_id is required" }, 400);

    if (type !== "text" && type !== "image" && type !== "video") {
      return json({ success: false, error: "type must be text, image, or video" }, 400);
    }

    if (type === "text" && !text_content) {
      return json({ success: false, error: "text_content is required" }, 400);
    }

    if ((type === "image" || type === "video") && !media_url) {
      return json({ success: false, error: "media_url is required" }, 400);
    }

    // Permanent stories: expires_at is always NULL
    const stmt = `
      INSERT INTO stories
      (user_id, type, media_url, text_content, background_style, music_url, music_title, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `;

    const bindArgs = [
      user_id,
      type,
      media_url,
      text_content,
      background_style,
      music_url,
      music_title,
    ];

    const result = await env.DB.prepare(stmt).bind(...bindArgs).run();
    const story_id = Number(result.meta?.last_row_id);

    const story = await env.DB.prepare(
      `
      SELECT
        s.*,
        u.username as author_name,
        u.profile_image_url as author_image,

        (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) AS views_count,
        (SELECT COUNT(*) FROM story_reactions sr WHERE sr.story_id = s.id) AS reactions_count,
        (SELECT sr.reaction
           FROM story_reactions sr
          WHERE sr.story_id = s.id
            AND sr.user_id = ?
          LIMIT 1
        ) AS my_reaction,

        EXISTS(
          SELECT 1 FROM story_views sv2
          WHERE sv2.story_id = s.id
            AND sv2.user_id = ?
        ) AS viewed_by_me,

        (SELECT COUNT(*) FROM story_reactions sr WHERE sr.story_id = s.id) AS likes_count,
        (SELECT 1
           FROM story_reactions sr
          WHERE sr.story_id = s.id
            AND sr.user_id = ?
          LIMIT 1
        ) AS liked_by_me

      FROM stories s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
      LIMIT 1
    `
    )
      .bind(user_id, user_id, user_id, story_id)
      .first();

    return json({ success: true, story }, 201);
  } catch (err: any) {
    return json(
      {
        success: false,
        error: "Backend crash",
        message: String(err?.message ?? err),
      },
      500
    );
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

        (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) AS views_count,
        (SELECT COUNT(*) FROM story_reactions sr WHERE sr.story_id = s.id) AS reactions_count,

        (SELECT sr.reaction
           FROM story_reactions sr
          WHERE sr.story_id = s.id
            AND sr.user_id = ?
          LIMIT 1
        ) AS my_reaction,

        EXISTS(
          SELECT 1 FROM story_views sv2
          WHERE sv2.story_id = s.id
            AND sv2.user_id = ?
        ) AS viewed_by_me,

        (SELECT COUNT(*) FROM story_reactions sr WHERE sr.story_id = s.id) AS likes_count,
        (SELECT 1
           FROM story_reactions sr
          WHERE sr.story_id = s.id
            AND sr.user_id = ?
          LIMIT 1
        ) AS liked_by_me

      FROM stories s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
      LIMIT 500
    `;

    const { results } = await env.DB
      .prepare(q)
      .bind(viewerId || 0, viewerId || 0, viewerId || 0)
      .all();

    return json(Array.isArray(results) ? results : []);
  } catch (err: any) {
    return json(
      {
        success: false,
        error: "Backend crash",
        message: String(err?.message ?? err),
      },
      500
    );
  }
};
