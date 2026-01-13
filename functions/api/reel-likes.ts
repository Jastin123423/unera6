export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { user_id, reel_id } = await request.json()

  await env.DB.prepare(`
    INSERT INTO reel_likes (user_id, reel_id)
    VALUES (?, ?)
  `).bind(user_id, reel_id).run()

  return Response.json({ success: true })
}
