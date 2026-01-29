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
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 10)));

    // Trending: highest uses in last 7 days (change window if you want)
    const res = await env.DB.prepare(
      `
      SELECT
        r.sound_key,
        MAX(r.song_name) as name,
        MAX(r.audio_url) as url,
        MAX(r.audio_start) as start,
        MAX(r.audio_end) as end,
        COUNT(*) as creationCount,
        COALESCE(SUM(r.views),0) as viewCount,
        COALESCE(SUM(r.shares),0) as shareCount
      FROM reels r
      WHERE r.sound_key IS NOT NULL AND r.sound_key != ''
      AND datetime(r.created_at) >= datetime('now','-7 days')
      GROUP BY r.sound_key
      ORDER BY creationCount DESC, viewCount DESC
      LIMIT ?
      `
    ).bind(limit).all<any>();

    const sounds = (res.results || []).map((s: any) => ({
      id: s.sound_key,
      soundKey: s.sound_key,
      name: s.name || "Original Sound",
      url: s.url || "",
      start: s.start ?? 0,
      end: s.end ?? 0,
      creationCount: s.creationCount ?? 0,
      viewCount: s.viewCount ?? 0,
      playCount: 0,
      isOriginal: String(s.sound_key).startsWith("original:"),
    }));

    return json({ success: true, sounds });
  } catch (e: any) {
    console.error("sounds/popular error:", e);
    return json({ success: false, error: e?.message || "Server error" }, 500);
  }
};
