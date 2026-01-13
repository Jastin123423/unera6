export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { creator_id, title, description, audio_url, cover_url } = await request.json()

  const result = await env.DB.prepare(`
    INSERT INTO podcasts (creator_id, title, description, audio_url, cover_url)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    creator_id,
    title,
    description ?? null,
    audio_url,
    cover_url ?? null
  ).run()

  return Response.json({ success: true, podcast_id: result.meta.last_row_id })
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  const { results } = await env.DB
    .prepare("SELECT * FROM podcasts ORDER BY created_at DESC")
    .all()

  return Response.json(results)
}
