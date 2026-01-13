export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { user_id, post_id, parent_comment_id, text } = await request.json()

  if (!user_id || !post_id || !text) {
    return new Response("Missing fields", { status: 400 })
  }

  await env.DB.prepare(
    `INSERT INTO group_post_comments
     (user_id, group_post_id, parent_comment_id, text)
     VALUES (?, ?, ?, ?)`
  )
    .bind(user_id, post_id, parent_comment_id ?? null, text)
    .run()

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  })
}
