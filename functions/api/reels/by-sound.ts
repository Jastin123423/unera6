import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const toInt = (v: any, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const url = new URL(request.url);
    const soundKey = (url.searchParams.get("sound_key") || "").trim();
    const limit = clamp(toInt(url.searchParams.get("limit"), 30), 1, 100);
    const cursor = (url.searchParams.get("cursor") || "").trim(); // created_at cursor (optional)

    if (!soundKey) return json({ success: false, error: "sound_key is required" }, 400);

    // Cursor pagination: created_at < cursor
    const whereCursor = cursor ? "AND r.created_at < ?" : "";

    const bindParams: any[] = cursor ? [soundKey, cursor, limit + 1] : [soundKey, limit + 1];

    // ✅ IMPORTANT:
    // This assumes you have a reels table with fields:
    // id, user_id, caption, video_url, audio_url, audio_start, audio_end, song_name, sound_key, views, shares, created_at
    // If your column names differ, rename them here.
    const q = `
      SELECT
        r.id,
        r.user_id,
        r.caption,
        r.video_url,
        r.audio_url,
        r.audio_start,
        r.audio_end,
        r.song_name,
        r.sound_key,
        r.views,
        r.shares,
        r.created_at,
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified
      FROM reels r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.sound_key = ?
      ${whereCursor}
      ORDER BY r.created_at DESC
      LIMIT ?
    `;

    const res = await env.DB.prepare(q).bind(...bindParams).all();

    const rows = (res?.results || []) as any[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore ? page[page.length - 1]?.created_at : null;

    // You can also join reactions/comments counts if you want.
    // For now keep it light to avoid heavy query cost.
    const reels = page.map((r) => ({
      id: r.id,
      userId: r.user_id,
      caption: r.caption,
      videoUrl: r.video_url,
      audioUrl: r.audio_url,
      audioStart: r.audio_start ?? 0,
      audioEnd: r.audio_end ?? 0,
      songName: r.song_name || "Original Sound",
      soundKey: r.sound_key || "original:none",
      views: r.views ?? 0,
      shares: r.shares ?? 0,
      created_at: r.created_at,
      user: {
        id: r.user_id,
        username: r.username,
        name: r.name || r.username || "User",
        profile_image_url: r.profile_image_url,
        is_verified: r.is_verified ?? 0,
      },
      // Keep empty arrays for UI consistency unless you already store them:
      reactions: [],
      comments: [],
    }));

    return json({ success: true, soundKey, limit, cursor: cursor || null, nextCursor, hasMore, reels });
  } catch (e: any) {
    console.error("reels/by-sound error:", e);
    return json({ success: false, error: e?.message || "Server error" }, 500);
  }
};
