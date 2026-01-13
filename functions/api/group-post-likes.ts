export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const { user_id, post_id } = await request.json()

    if (!user_id || !post_id) {
      return new Response("Missing fields", { status: 400 })
    }

    await env.DB.prepare(
      `INSERT INTO group_post_likes (user_id, group_post_id)
       VALUES (?, ?)`
    )
      .bind(user_id, post_id)
      .run()

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500 }
    )
  }
}
