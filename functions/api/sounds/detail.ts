import type { PagesFunction } from "@cloudflare/workers-types";
type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const soundKey = (url.searchParams.get("sound_key") || "").trim();
    if (!soundKey) return json({ success: false, error: "sound_key is required" }, 400);

    // Pull one representative reel for this sound (gets name/url/start/end)
    const base = await env.DB.prepare(
      `
      SELECT
        r.sound_key,
        r.song_name,
        r.audio_url,
        r.audio_start,
        r.audio_end
      FROM reels r
      WHERE r.sound_key = ?
      ORDER BY r.created_at DESC
      LIMIT 1
      `
    ).bind(soundKey).first<any>();

    if (!base) return json({ success: false, error: "Sound not found" }, 404);

    // Aggregates
    const agg = await env.DB.prepare(
      `
      SELECT
        COUNT(*) as uses,
        COALESCE(SUM(views),0) as totalViews,
        COALESCE(SUM(shares),0) as totalShares
      FROM reels
      WHERE sound_key = ?
      `
    ).bind(soundKey).first<any>();

    return json({
      success: true,
      sound: {
        id: soundKey,
        soundKey,
        name: base.song_name || "Original Sound",
        url: base.audio_url || "",
        start: base.audio_start ?? 0,
        end: base.audio_end ?? 0,
        creationCount: agg?.uses ?? 0,
        viewCount: agg?.totalViews ?? 0,
        playCount: 0,      // optional: if you track separately
        duration: 30,      // optional: you can store duration in DB later
        isOriginal: soundKey.startsWith("original:"),
      },
    });
  } catch (e: any) {
    console.error("sounds/detail error:", e);
    return json({ success: false, error: e?.message || "Server error" }, 500);
  }
};
