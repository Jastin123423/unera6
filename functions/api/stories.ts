export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const {
    user_id,
    type,
    media_url,
    text_content,
    background_style,
    music_url,
    music_title,
    expires_at
  } = await request.json()

  const result = await env.DB.prepare(`
    INSERT INTO stories
    (user_id, type, media_url, text_content, background_style, music_url, music_title, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    user_id,
    type,
    media_url ?? null,
    text_content ?? null,
    background_style ?? null,
    music_url ?? null,
    music_title ?? null,
    expires_at
  ).run()

  return Response.json({ success: true, story_id: result.meta.last_row_id })
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  const { results } = await env.DB.prepare(`
    SELECT * FROM stories
    WHERE expires_at > datetime('now')
    ORDER BY created_at DESC
  `).all()

  return Response.json(results)
}
