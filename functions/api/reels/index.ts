// functions/api/reels/index.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const toNum = (v: any, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toStr = (v: any, fallback = "") => (typeof v === "string" ? v : fallback);

const safeLimit = (v: any, def = 50, min = 1, max = 100) => {
  const n = Math.floor(toNum(v, def));
  return Math.max(min, Math.min(max, n));
};

// NOTE: You can customize this to match your users table column names.
const USER_PUBLIC_FIELDS = `
  u.id as user_id,
  COALESCE(u.username, '') as username,
  COALESCE(u.name, u.username, 'User') as name,
  COALESCE(u.profile_image_url, '') as profile_image_url,
  COALESCE(u.is_verified, 0) as is_verified,
  COALESCE(u.role, 'user') as role
`;

// Expected tables (example):
// reels: id, user_id, caption, video_url, sound_id, visibility, location, views, shares, created_at,
//       (optional legacy): song_name, audio_url, audio_start, audio_end, song_id, sound_key
// sounds: id, sound_key, title, audio_url, trim_start, trim_end, source_song_id, created_at, ...

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const url = new URL(request.url);
    const limit = safeLimit(url.searchParams.get("limit"), 50, 1, 100);
    const cursor = url.searchParams.get("cursor"); // created_at cursor (optional)

    // Cursor pagination using created_at (string datetime)
    // If you use numeric ids instead, change to WHERE r.id < ?
    const where = cursor ? `WHERE r.created_at < ?1` : "";
    const bindArgs = cursor ? [cursor, limit] : [limit];

    const q = `
      SELECT
        r.id,
        r.user_id,
        COALESCE(r.caption,'') as caption,
        COALESCE(r.video_url,'') as video_url,
        COALESCE(r.visibility,'public') as visibility,
        COALESCE(r.location,'') as location,
        COALESCE(r.views,0) as views,
        COALESCE(r.shares,0) as shares,
        r.created_at,

        -- New sound system:
        r.sound_id,

        -- Legacy fields (keep for old clients; may be empty if you moved to sound_id)
        COALESCE(r.song_name,'') as song_name,
        COALESCE(r.audio_url,'') as audio_url,
        COALESCE(r.audio_start,0) as audio_start,
        COALESCE(r.audio_end,0) as audio_end,
        r.song_id,
        COALESCE(r.sound_key,'') as sound_key,

        -- Join user:
        ${USER_PUBLIC_FIELDS},

        -- Join sound:
        s.id as s_id,
        COALESCE(s.sound_key,'') as s_sound_key,
        COALESCE(s.title,'') as s_title,
        COALESCE(s.audio_url,'') as s_audio_url,
        COALESCE(s.trim_start,0) as s_trim_start,
        COALESCE(s.trim_end,0) as s_trim_end,
        s.source_song_id as s_source_song_id,
        s.created_at as s_created_at
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN sounds s ON s.id = r.sound_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT ?${cursor ? "2" : "1"}
    `;

    const res = cursor
      ? await env.DB.prepare(q).bind(bindArgs[0], bindArgs[1]).all<any>()
      : await env.DB.prepare(q).bind(bindArgs[0]).all<any>();

    const rows = Array.isArray(res?.results) ? res.results : [];

    // Shape response to match your normalizeReel() expectations:
    const reels = rows.map((r: any) => {
      const sound =
        r?.s_id
          ? {
              id: r.s_id,
              sound_key: r.s_sound_key,
              title: r.s_title,
              audio_url: r.s_audio_url,
              trim_start: r.s_trim_start,
              trim_end: r.s_trim_end,
              source_song_id: r.s_source_song_id ?? null,
              created_at: r.s_created_at ?? null,
            }
          : null;

      // IMPORTANT:
      // - If you want old clients to work, keep legacy fields too.
      // - New clients should prefer sound_id + sound object.
      return {
        id: r.id,
        user_id: r.user_id,
        caption: r.caption,
        video_url: r.video_url,
        visibility: r.visibility,
        location: r.location,
        views: r.views,
        shares: r.shares,
        created_at: r.created_at,

        sound_id: r.sound_id ?? null,
        sound,

        // legacy:
        song_name: r.song_name,
        audio_url: r.audio_url,
        audio_start: r.audio_start,
        audio_end: r.audio_end,
        song_id: r.song_id ?? null,
        sound_key: r.sound_key,

        // user info for UI:
        username: r.username,
        name: r.name,
        profile_image_url: r.profile_image_url,
        is_verified: r.is_verified,
        role: r.role,
      };
    });

    const nextCursor = reels.length ? reels[reels.length - 1].created_at : null;

    return json({
      success: true,
      reels,
      nextCursor,
      hasMore: reels.length === limit,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Failed to fetch reels" }, 500);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({}));

    const user_id = toNum(body?.user_id, 0);
    const caption = toStr(body?.caption, "").trim();
    const video_url = toStr(body?.video_url, "").trim();
    const visibility = (toStr(body?.visibility, "public").trim().toLowerCase() === "private")
      ? "private"
      : "public";
    const location = toStr(body?.location, "").trim();

    // New sound system:
    const sound_id = body?.sound_id === null || body?.sound_id === undefined
      ? null
      : (toNum(body?.sound_id, 0) || null);

    // Legacy fields (optional; keep them for backward compatibility)
    const song_name = toStr(body?.song_name, "").trim();
    const audio_url = toStr(body?.audio_url, "").trim();
    const audio_start = toNum(body?.audio_start, 0);
    const audio_end = toNum(body?.audio_end, 0);
    const song_id = body?.song_id === null || body?.song_id === undefined
      ? null
      : (toNum(body?.song_id, 0) || null);
    const sound_key = toStr(body?.sound_key, "").trim();

    if (!user_id) return json({ success: false, error: "user_id is required" }, 400);
    if (!video_url) return json({ success: false, error: "video_url is required" }, 400);

    // Optional: validate sound_id exists if provided
    if (sound_id) {
      const s = await env.DB.prepare(`SELECT id FROM sounds WHERE id = ?1 LIMIT 1`)
        .bind(sound_id)
        .first<any>();
      if (!s?.id) return json({ success: false, error: "sound_id not found" }, 400);
    }

    const created_at = new Date().toISOString();

    // Insert reel
    const insert = await env.DB.prepare(
      `INSERT INTO reels
        (user_id, caption, video_url, sound_id, visibility, location, views, shares, created_at,
         song_name, audio_url, audio_start, audio_end, song_id, sound_key)
       VALUES
        (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7,
         ?8, ?9, ?10, ?11, ?12, ?13)`
    )
      .bind(
        user_id,
        caption,
        video_url,
        sound_id,
        visibility,
        location,
        created_at,
        // legacy
        song_name,
        audio_url,
        audio_start,
        audio_end,
        song_id,
        sound_key
      )
      .run();

    // D1 returns last_row_id in meta (usually)
    const newId = (insert as any)?.meta?.last_row_id;

    // Return the created reel using the same SELECT as GET (single row)
    const row = await env.DB.prepare(
      `
      SELECT
        r.id,
        r.user_id,
        COALESCE(r.caption,'') as caption,
        COALESCE(r.video_url,'') as video_url,
        COALESCE(r.visibility,'public') as visibility,
        COALESCE(r.location,'') as location,
        COALESCE(r.views,0) as views,
        COALESCE(r.shares,0) as shares,
        r.created_at,

        r.sound_id,

        COALESCE(r.song_name,'') as song_name,
        COALESCE(r.audio_url,'') as audio_url,
        COALESCE(r.audio_start,0) as audio_start,
        COALESCE(r.audio_end,0) as audio_end,
        r.song_id,
        COALESCE(r.sound_key,'') as sound_key,

        ${USER_PUBLIC_FIELDS},

        s.id as s_id,
        COALESCE(s.sound_key,'') as s_sound_key,
        COALESCE(s.title,'') as s_title,
        COALESCE(s.audio_url,'') as s_audio_url,
        COALESCE(s.trim_start,0) as s_trim_start,
        COALESCE(s.trim_end,0) as s_trim_end,
        s.source_song_id as s_source_song_id,
        s.created_at as s_created_at
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN sounds s ON s.id = r.sound_id
      WHERE r.id = ?1
      LIMIT 1
      `
    )
      .bind(toNum(newId, toNum(body?.id, 0)))
      .first<any>();

    if (!row?.id) {
      // fallback minimal response
      return json({
        success: true,
        reel: {
          id: newId ?? Date.now(),
          user_id,
          caption,
          video_url,
          sound_id,
          visibility,
          location,
          views: 0,
          shares: 0,
          created_at,
          // legacy:
          song_name,
          audio_url,
          audio_start,
          audio_end,
          song_id,
          sound_key,
        },
      });
    }

    const sound =
      row?.s_id
        ? {
            id: row.s_id,
            sound_key: row.s_sound_key,
            title: row.s_title,
            audio_url: row.s_audio_url,
            trim_start: row.s_trim_start,
            trim_end: row.s_trim_end,
            source_song_id: row.s_source_song_id ?? null,
            created_at: row.s_created_at ?? null,
          }
        : null;

    return json({
      success: true,
      reel: {
        id: row.id,
        user_id: row.user_id,
        caption: row.caption,
        video_url: row.video_url,
        visibility: row.visibility,
        location: row.location,
        views: row.views,
        shares: row.shares,
        created_at: row.created_at,

        sound_id: row.sound_id ?? null,
        sound,

        // legacy:
        song_name: row.song_name,
        audio_url: row.audio_url,
        audio_start: row.audio_start,
        audio_end: row.audio_end,
        song_id: row.song_id ?? null,
        sound_key: row.sound_key,

        // user info:
        username: row.username,
        name: row.name,
        profile_image_url: row.profile_image_url,
        is_verified: row.is_verified,
        role: row.role,
      },
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Failed to create reel" }, 500);
  }
};
