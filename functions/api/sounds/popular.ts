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
    const limit = Math.min(Number(url.searchParams.get("limit") || 10), 50);

    const rows = await env.DB.prepare(
      `
      SELECT
        sound_key,
        MAX(song_name) AS song_name,
        MAX(audio_url) AS audio_url,
        MAX(audio_start) AS audio_start,
        MAX(audio_end) AS audio_end,
        MAX(song_id) AS song_id,
        COUNT(*) AS uses,
        COALESCE(SUM(views), 0) AS total_views
      FROM reels
      WHERE sound_key IS NOT NULL AND sound_key != ''
      GROUP BY sound_key
      ORDER BY uses DESC, total_views DESC
      LIMIT ?
      `
    ).bind(limit).all();

    const sounds = (rows.results || []).map((r: any) => {
      const start = Number(r.audio_start || 0);
      const end = Number(r.audio_end || 0);
      const duration = end > start ? Math.max(1, end - start) : 30;

      return {
        id: r.sound_key,
        soundKey: r.sound_key,
        name: r.song_name || "Original Sound",
        url: r.audio_url || "",
        start,
        end,
        songId: r.song_id ? Number(r.song_id) : null,
        duration,
        creationCount: Number(r.uses || 0),
        viewCount: Number(r.total_views || 0),
        playCount: Number(r.total_views || 0),
        isOriginal: String(r.sound_key).startsWith("original:"),
      };
    });

    return json({ success: true, sounds });
  } catch (e: any) {
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
};
