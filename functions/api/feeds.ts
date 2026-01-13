import { Env } from "../env"

export async function handleFeed(req: Request, env: Env) {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 })

  const url = new URL(req.url)
  const userId = url.searchParams.get("userId")
  const limit = Number(url.searchParams.get("limit") || 20)

  if (!userId) return new Response("Missing userId", { status: 400 })

  const query = `
    SELECT posts.id, posts.content, posts.media_url, posts.media_type, posts.created_at,
           users.id AS user_id, users.username, users.profile_image_url
    FROM posts
    JOIN users ON users.id = posts.user_id
    WHERE posts.user_id = ?
       OR posts.user_id IN (
         SELECT following_id
         FROM user_follows
         WHERE follower_id = ?
       )
    ORDER BY posts.created_at DESC
    LIMIT ?
  `

  const { results } = await env.DB.prepare(query).bind(userId, userId, limit).all()

  return new Response(JSON.stringify({ success: true, feed: results }), {
    headers: { "Content-Type": "application/json" }
  })
}
