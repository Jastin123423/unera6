import type { PagesFunction } from "@cloudflare/workers-types";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const safeNum = (v: any) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const onRequestPost: PagesFunction = async ({ env, request, params }) => {
  try {
    const songId = safeNum((params as any)?.id);
    if (!songId) return new Response(JSON.stringify({ error: "Invalid song id" }), { status: 400, headers: cors });

    const body = await request.json().catch(() => ({} as any));
    const user_id = body?.user_id != null ? safeNum(body.user_id) : null;

    // ✅ always increment counter
    await env.DB.prepare(`
      UPDATE songs
      SET plays_count = COALESCE(plays_count, 0) + 1
      WHERE id = ?
    `).bind(songId).run();

    // ✅ optional analytics
    await env.DB.prepare(`
      INSERT INTO song_plays (song_id, user_id) VALUES (?, ?)
    `).bind(songId, user_id).run().catch(() => {});

    const row = await env.DB.prepare(`SELECT COALESCE(plays_count,0) AS plays_count FROM songs WHERE id=?`)
      .bind(songId)
      .first();

    return new Response(JSON.stringify({ success: true, plays_count: row?.plays_count ?? 0 }), { status: 200, headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), { status: 500, headers: cors });
  }
};
