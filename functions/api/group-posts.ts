export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { group_id, user_id, content, media_url } = await request.json()

  const result = await env.DB.prepare(`
    INSERT INTO group_posts (group_id, user_id, content, media_url)
    VALUES (?, ?, ?, ?)
  `).bind(group_id, user_id, content ?? null, media_url ?? null).run()

  return Response.json({ success: true, post_id: result.meta.last_row_id })
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  const { results } = await env.DB
    .prepare("SELECT * FROM group_posts ORDER BY created_at DESC")
    .all()

  return Response.json(results)
}
