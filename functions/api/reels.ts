export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { user_id, video_url, caption, song_name } = await request.json()

  const result = await env.DB.prepare(`
    INSERT INTO reels (user_id, video_url, caption, song_name)
    VALUES (?, ?, ?, ?)
  `).bind(user_id, video_url, caption ?? null, song_name ?? null).run()

  return Response.json({ success: true, reel_id: result.meta.last_row_id })
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  const { results } = await env.DB
    .prepare("SELECT * FROM reels ORDER BY created_at DESC")
    .all()

  return Response.json(results)
}
