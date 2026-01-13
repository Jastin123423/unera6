export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const { user_id, song_id } = await request.json()

    await env.DB.prepare(`
      INSERT INTO song_likes (user_id, song_id)
      VALUES (?, ?)
    `)
      .bind(user_id, song_id)
      .run()

    return new Response(JSON.stringify({ success: true }))
  } catch (e: any) {
    if (e.message.includes("UNIQUE")) {
      return new Response(JSON.stringify({ error: "Already liked" }), { status: 409 })
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
