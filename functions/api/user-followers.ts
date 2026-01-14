export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const { follower_id, following_id } = await request.json()

    if (!follower_id || !following_id) {
      return new Response(
        JSON.stringify({ error: "follower_id and following_id are required" }),
        { status: 400 }
      )
    }

    if (Number(follower_id) === Number(following_id)) {
      return new Response(
        JSON.stringify({ error: "You cannot follow yourself" }),
        { status: 400 }
      )
    }

    await env.DB.prepare(
      `INSERT INTO user_follows (follower_id, following_id)
       VALUES (?, ?)`
    )
      .bind(follower_id, following_id)
      .run()

    return new Response(
      JSON.stringify({ success: true }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    )

  } catch (e: any) {
    if (e.message?.includes("UNIQUE") || e.message?.includes("PRIMARY")) {
      return new Response(
        JSON.stringify({ error: "Already following" }),
        { status: 409 }
      )
    }

    if (e.message?.includes("FOREIGN KEY")) {
      return new Response(
        JSON.stringify({ error: "Invalid follower_id or following_id" }),
        { status: 400 }
      )
    }

    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500 }
    )
  }
}

export const onRequestDelete: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url)
  const follower_id = url.searchParams.get("follower_id")
  const following_id = url.searchParams.get("following_id")

  if (!follower_id || !following_id) {
    return new Response(
      JSON.stringify({ error: "follower_id and following_id are required" }),
      { status: 400 }
    )
  }

  const result = await env.DB.prepare(
    `DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?`
  )
    .bind(follower_id, following_id)
    .run()

  if ((result.meta?.changes ?? 0) === 0) {
    return new Response(
      JSON.stringify({ error: "Not following" }),
      { status: 404 }
    )
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  )
}
