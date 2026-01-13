export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { admin_id, name, description, type, cover_image, profile_image } =
    await request.json()

  const result = await env.DB.prepare(`
    INSERT INTO groups (admin_id, name, description, type, cover_image, profile_image)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    admin_id,
    name,
    description ?? null,
    type,
    cover_image ?? null,
    profile_image ?? null
  ).run()

  return Response.json({ success: true, group_id: result.meta.last_row_id })
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  const { results } = await env.DB
    .prepare("SELECT * FROM groups ORDER BY created_at DESC")
    .all()

  return Response.json(results)
}
