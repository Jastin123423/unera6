const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction = async ({ env, request }) => {
  const url = new URL(request.url);
  const uploaderId = url.searchParams.get("uploaderId");

  const stmt = uploaderId
    ? env.DB.prepare(`SELECT * FROM songs WHERE uploader_id = ? ORDER BY datetime(created_at) DESC LIMIT 200`)
        .bind(Number(uploaderId))
    : env.DB.prepare(`SELECT * FROM songs ORDER BY datetime(created_at) DESC LIMIT 200`);

  const { results } = await stmt.all();
  return new Response(JSON.stringify(results || []), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));

    const uploader_id = Number(body.uploader_id);
    const title = String(body.title ?? "").trim();
    const artist_name = String(body.artist_name ?? "").trim();
    const album_name = body.album_name ? String(body.album_name).trim() : null;
    const cover_image_url = body.cover_image_url ? String(body.cover_image_url).trim() : null;
    const audio_url = String(body.audio_url ?? "").trim();
    const duration_seconds = body.duration_seconds != null ? Number(body.duration_seconds) : null;
    const genre = body.genre ? String(body.genre).trim() : null;

    if (!uploader_id || !title || !artist_name || !audio_url) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const created_at = new Date().toISOString();

    const insert = await env.DB.prepare(
      `INSERT INTO songs
       (uploader_id, title, artist_name, album_name, cover_image_url, audio_url, duration_seconds, genre, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(uploader_id, title, artist_name, album_name, cover_image_url, audio_url, duration_seconds, genre, created_at)
      .run();

    const id = Number((insert as any)?.meta?.last_row_id || 0);

    return new Response(JSON.stringify({
      success: true,
      song: { id, uploader_id, title, artist_name, album_name, cover_image_url, audio_url, duration_seconds, genre, created_at }
    }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
};
