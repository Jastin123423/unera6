export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { user_id, content, media_url, media_type } = await request.json()

  const result = await env.DB
    .prepare(`
      INSERT INTO posts (user_id, content, media_url, media_type)
      VALUES (?, ?, ?, ?)
    `)
    .bind(user_id, content, media_url ?? null, media_type ?? null)
    .run()

  return Response.json({ success: true, post_id: result.meta.last_row_id })
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  const { results } = await env.DB
    .prepare("SELECT * FROM posts ORDER BY created_at DESC")
    .all()

  return Response.json(results)
}
