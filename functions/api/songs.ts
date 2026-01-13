export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const {
      uploader_id,
      title,
      artist_name,
      album_name,
      cover_image_url,
      audio_url,
      duration_seconds,
      genre
    } = await request.json()

    if (!uploader_id || !title || !artist_name || !audio_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      )
    }

    await env.DB.prepare(`
      INSERT INTO songs
      (uploader_id, title, artist_name, album_name, cover_image_url, audio_url, duration_seconds, genre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        uploader_id,
        title,
        artist_name,
        album_name ?? null,
        cover_image_url ?? null,
        audio_url,
        duration_seconds ?? null,
        genre ?? null
      )
      .run()

    return new Response(JSON.stringify({ success: true }))
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
