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
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/**
 * GET /api/reels/by-sound?sound_id=12&limit=60
 * (legacy supported) /api/reels/by-sound?sound_key=original:xxx&limit=60
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);

    const soundId = toNum(url.searchParams.get("sound_id"), 0);
    const soundKey = (url.searchParams.get("sound_key") || "").trim(); // legacy fallback

    const limit = Math.min(Number(url.searchParams.get("limit") || 60), 120);

    if (!soundId && !soundKey) {
      return json({ success: false, error: "sound_id or sound_key is required" }, 400);
    }

    // ✅ Join sounds so new reels get audio fields from sounds table
    // ✅ Fallback to reels columns for old data
    const q = `
      SELECT
        r.id,
        r.user_id,
        r.video_url,
        r.caption,
        r.views,
        r.shares,
        r.created_at,

        -- unified sound fields
        COALESCE(s.title, r.song_name) AS song_name,
        COALESCE(s.audio_url, r.audio_url) AS audio_url,
        COALESCE(s.trim_start, r.audio_start) AS audio_start,
        COALESCE(s.trim_end, r.audio_end) AS audio_end,
        COALESCE(s.source_song_id, r.song_id) AS song_id,
        COALESCE(s.sound_key, r.sound_key) AS sound_key,

        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified

      FROM reels r
      LEFT JOIN sounds s ON s.id = r.sound_id
      LEFT JOIN users u ON u.id = r.user_id

      WHERE ${
        soundId
          ? "r.sound_id = ?"
          : "r.sound_key = ?"
      }
      ORDER BY r.created_at DESC
      LIMIT ?
    `;

    const bindVal = soundId ? soundId : soundKey;
    const rows = await env.DB.prepare(q).bind(bindVal, limit).all();

    // Map to EXACT shape your Reels.tsx expects
    const reels = (rows.results || []).map((r: any) => ({
      id: Number(r.id),
      userId: Number(r.user_id),
      videoUrl: r.video_url,
      caption: r.caption || "",

      songName: r.song_name || "Original Sound",
      audioUrl: r.audio_url || "",
      audioStart: Number(r.audio_start || 0),
      audioEnd: Number(r.audio_end || 0),

      views: Number(r.views || 0),
      shares: Number(r.shares || 0),

      songId: r.song_id ? Number(r.song_id) : null,
      soundKey: r.sound_key || "original:none",
      createdAt: r.created_at,

      author: {
        id: Number(r.user_id),
        username: r.username || "",
        name: r.name || r.username || "User",
        profile_image_url: r.profile_image_url || null,
        is_verified: Number(r.is_verified || 0),
      },

      reactions: [],
      comments: [],
    }));

    return json({ success: true, reels });
  } catch (e: any) {
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
};
