import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const pickFirst = (...values: any[]) => {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
};

const safeBool = (v: any) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
  }
  return false;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const soundKey = (url.searchParams.get("sound_key") || "").trim();
    const limit = Math.min(Number(url.searchParams.get("limit") || 60), 120);

    if (!soundKey) {
      return json({ success: false, error: "sound_key is required" }, 400);
    }

    let whereSql = `r.sound_key = ?`;
    let bindValues: any[] = [soundKey];

    const originalReelMatch = soundKey.match(/^original:reel:(\d+)$/);
    if (originalReelMatch) {
      const sourceReelId = Number(originalReelMatch[1]);
      whereSql = `(r.sound_key = ? OR r.sound_id = ? OR r.original_sound_owner_id = ?)`;
      bindValues = [soundKey, sourceReelId, sourceReelId];
    }

    const q = `
      SELECT
        r.id,
        r.user_id,
        r.video_url,
        r.video_url_low,
        r.video_url_medium,
        r.video_url_hd,
        r.thumbnail_url,
        r.caption,
        r.song_name,
        r.audio_url,
        r.audio_start,
        r.audio_end,
        r.views,
        r.shares,
        r.song_id,
        r.sound_id,
        r.sound_key,
        r.is_original_sound,
        r.original_sound_owner_id,
        r.created_at,
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE ${whereSql}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ?
    `;

    const rows = await env.DB.prepare(q).bind(...bindValues, limit).all();

    const reels = (rows.results || []).map((r: any) => {
      const videoUrl = pickFirst(r.video_url_medium, r.video_url, r.video_url_low, r.video_url_hd);

      return {
        id: toNum(r.id),
        userId: toNum(r.user_id),
        user_id: toNum(r.user_id),

        videoUrl,
        video_url: videoUrl,
        video_url_low: pickFirst(r.video_url_low),
        video_url_medium: pickFirst(r.video_url_medium, r.video_url),
        video_url_hd: pickFirst(r.video_url_hd),

        thumbnail_url: pickFirst(r.thumbnail_url),
        thumbnail: pickFirst(r.thumbnail_url),

        caption: pickFirst(r.caption),
        songName: pickFirst(r.song_name, "Original Sound"),
        song_name: pickFirst(r.song_name, "Original Sound"),

        audioUrl: pickFirst(r.audio_url),
        audio_url: pickFirst(r.audio_url),
        audioStart: toNum(r.audio_start, 0),
        audio_start: toNum(r.audio_start, 0),
        audioEnd: toNum(r.audio_end, 0),
        audio_end: toNum(r.audio_end, 0),

        views: toNum(r.views, 0),
        shares: toNum(r.shares, 0),

        songId: r.song_id == null ? null : toNum(r.song_id, 0),
        song_id: r.song_id == null ? null : toNum(r.song_id, 0),
        soundId: r.sound_id == null ? null : toNum(r.sound_id, 0),
        sound_id: r.sound_id == null ? null : toNum(r.sound_id, 0),
        soundKey: pickFirst(r.sound_key, "original:none"),
        sound_key: pickFirst(r.sound_key, "original:none"),

        is_original_sound: safeBool(r.is_original_sound),
        original_sound_owner_id:
          r.original_sound_owner_id == null ? null : toNum(r.original_sound_owner_id, 0),

        createdAt: r.created_at,
        created_at: r.created_at,

        author: {
          id: toNum(r.user_id),
          username: pickFirst(r.username),
          name: pickFirst(r.name, r.username, "User"),
          profile_image_url: pickFirst(r.profile_image_url) || null,
          is_verified: safeBool(r.is_verified),
        },

        reactions: [],
        comments: [],
      };
    });

    return json({ success: true, reels });
  } catch (e: any) {
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
};
