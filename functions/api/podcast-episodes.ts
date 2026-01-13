export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const {
      uploader_id,
      title,
      description,
      cover_image_url,
      audio_url,
      duration_seconds,
      season_number,
      episode_number
    } = await request.json()

    if (!uploader_id || !title || !audio_url) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
    }

    await env.DB.prepare(`
      INSERT INTO podcast_episodes
      (uploader_id, title, description, cover_image_url, audio_url, duration_seconds, season_number, episode_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        uploader_id,
        title,
        description ?? null,
        cover_image_url ?? null,
        audio_url,
        duration_seconds ?? null,
        season_number ?? null,
        episode_number ?? null
      )
      .run()

    return new Response(JSON.stringify({ success: true }))
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
