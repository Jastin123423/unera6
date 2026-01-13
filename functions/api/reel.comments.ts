export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { user_id, reel_id, text } = await request.json()

  await env.DB.prepare(`
    INSERT INTO reel_comments (user_id, reel_id, text)
    VALUES (?, ?, ?)
  `).bind(user_id, reel_id, text).run()

  return Response.json({ success: true })
}
