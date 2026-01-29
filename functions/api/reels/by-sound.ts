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

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const soundKey = (url.searchParams.get("sound_key") || "").trim();
    const limit = Math.min(Number(url.searchParams.get("limit") || 60), 120);

    if (!soundKey) return json({ success: false, error: "sound_key is required" }, 400);

    const q = `
      SELECT
        r.id,
        r.user_id,
        r.video_url,
        r.caption,
        r.song_name,
        r.audio_url,
        r.audio_start,
        r.audio_end,
        r.views,
        r.shares,
        r.song_id,
        r.sound_key,
        r.created_at,
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.sound_key = ?
      ORDER BY r.created_at DESC
      LIMIT ?
    `;
    const rows = await env.DB.prepare(q).bind(soundKey, limit).all();

    // Map to the EXACT shape your Reels.tsx expects
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

      // Optional author fields (handy in UI)
      author: {
        id: Number(r.user_id),
        username: r.username || "",
        name: r.name || r.username || "User",
        profile_image_url: r.profile_image_url || null,
        is_verified: Number(r.is_verified || 0),
      },

      // IMPORTANT: your UI expects arrays
      reactions: [],
      comments: [],
    }));

    return json({ success: true, reels });
  } catch (e: any) {
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
};
