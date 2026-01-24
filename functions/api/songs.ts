import type { PagesFunction } from "@cloudflare/workers-types";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const safeStr = (v: any) => String(v ?? "").trim();
const safeNum = (v: any) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));

    // ✅ accept multiple possible keys from frontend
    const uploader_id = safeNum(body.uploader_id ?? body.user_id ?? body.artist_id ?? body.creator_id);
    const title = safeStr(body.title);
    const artist_name = safeStr(body.artist_name ?? body.artist ?? body.uploader_name ?? body.creator_name);
    const album_name = safeStr(body.album_name ?? body.album) || null;

    const cover_image_url = safeStr(body.cover_image_url ?? body.cover_url ?? body.cover) || null;
    const audio_url = safeStr(body.audio_url ?? body.audio ?? body.url ?? body.media_url);

    const duration_seconds =
      safeNum(body.duration_seconds ?? body.duration ?? body.durationSecs) || null;

    const genre = safeStr(body.genre) || null;

    // ✅ clear error response showing exactly what is missing
    const missing: string[] = [];
    if (!uploader_id) missing.push("uploader_id (or user_id)");
    if (!title) missing.push("title");
    if (!artist_name) missing.push("artist_name (or artist)");
    if (!audio_url) missing.push("audio_url (or audio/url/media_url)");

    if (missing.length) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          missing,
          received: {
            uploader_id,
            title: Boolean(title),
            artist_name: Boolean(artist_name),
            audio_url: Boolean(audio_url),
          },
        }),
        { status: 400, headers: cors }
      );
    }

    const result = await env.DB.prepare(`
      INSERT INTO songs
      (uploader_id, title, artist_name, album_name, cover_image_url, audio_url, duration_seconds, genre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        uploader_id,
        title,
        artist_name,
        album_name,
        cover_image_url,
        audio_url,
        duration_seconds,
        genre
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        song_id: (result as any)?.meta?.last_row_id ?? null,
      }),
      { status: 200, headers: cors }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: cors,
    });
  }
};

// ✅ optional: fetch songs for dashboard
export const onRequestGet: PagesFunction = async ({ env }) => {
  try {
    const { results } = await env.DB
      .prepare(`SELECT * FROM songs ORDER BY created_at DESC`)
      .all();

    return new Response(JSON.stringify(results || []), { status: 200, headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: cors,
    });
  }
};
