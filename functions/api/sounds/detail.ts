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
    if (!soundKey) return json({ success: false, error: "sound_key is required" }, 400);

    // Pick ONE representative reel for this sound (latest)
    const row = await env.DB.prepare(
      `
      SELECT
        r.sound_key,
        r.song_name,
        r.audio_url,
        r.audio_start,
        r.audio_end,
        r.song_id,
        r.user_id,
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.sound_key = ?
      ORDER BY r.created_at DESC
      LIMIT 1
      `
    ).bind(soundKey).first();

    if (!row) return json({ success: false, error: "Sound not found" }, 404);

    // Stats
    const stats = await env.DB.prepare(
      `
      SELECT
        COUNT(*) AS uses,
        COALESCE(SUM(views), 0) AS total_views,
        COALESCE(SUM(shares), 0) AS total_shares
      FROM reels
      WHERE sound_key = ?
      `
    ).bind(soundKey).first();

    const uses = Number((stats as any)?.uses || 0);
    const totalViews = Number((stats as any)?.total_views || 0);
    const totalShares = Number((stats as any)?.total_shares || 0);

    // Duration estimate (if end > start use it, else fallback 30)
    const start = Number((row as any).audio_start || 0);
    const end = Number((row as any).audio_end || 0);
    const duration = end > start ? Math.max(1, end - start) : 30;

    const sound = {
      id: soundKey,                  // keep id as soundKey (stable)
      soundKey: soundKey,
      name: (row as any).song_name || "Original Sound",
      url: (row as any).audio_url || "",
      start,
      end,
      songId: (row as any).song_id ? Number((row as any).song_id) : null,
      isOriginal: soundKey.startsWith("original:"),
      duration,

      creationCount: uses,
      viewCount: totalViews,
      playCount: totalViews, // simple approach: plays ~= views

      creator: {
        id: Number((row as any).user_id),
        username: (row as any).username || "",
        name: (row as any).name || (row as any).username || "User",
        profile_image_url: (row as any).profile_image_url || null,
        is_verified: Number((row as any).is_verified || 0),
      },

      totalShares,
    };

    return json({ success: true, sound });
  } catch (e: any) {
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
};
