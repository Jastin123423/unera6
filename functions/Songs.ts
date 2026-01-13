
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  })
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  try {
    const { results } = await (env as any).DB
      .prepare("SELECT * FROM songs ORDER BY created_at DESC")
      .all();

    return new Response(JSON.stringify(results), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body: any = await request.json();
    const {
      uploader_id,
      title,
      artist_name,
      album_name,
      cover_image_url,
      audio_url,
      duration_seconds,
      genre
    } = body;

    if (!uploader_id || !title || !artist_name || !audio_url) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const result = await (env as any).DB.prepare(`
      INSERT INTO songs
      (uploader_id, title, artist_name, album_name, cover_image_url, audio_url, duration_seconds, genre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        uploader_id,
        title,
        artist_name,
        album_name ?? null,
        cover_image_url ?? "https://images.unsplash.com/photo-1514525253440-b393452e8d26?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        audio_url,
        duration_seconds ?? null,
        genre ?? null
      )
      .run();

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
