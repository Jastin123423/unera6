export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const { user_id, episode_id } = await request.json()

    await env.DB.prepare(`
      INSERT INTO podcast_episode_likes (user_id, episode_id)
      VALUES (?, ?)
    `)
      .bind(user_id, episode_id)
      .run()

    return new Response(JSON.stringify({ success: true }))
  } catch (e: any) {
    if (e.message.includes("UNIQUE")) {
      return new Response(JSON.stringify({ error: "Already liked" }), { status: 409 })
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
