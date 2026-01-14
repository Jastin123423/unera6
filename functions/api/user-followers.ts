export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const { follower_id, following_id } = await request.json()

    if (!follower_id || !following_id) {
      return new Response(
        JSON.stringify({ error: "follower_id and following_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    if (Number(follower_id) === Number(following_id)) {
      return new Response(
        JSON.stringify({ error: "You cannot follow yourself" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Insert follow relationship (PK prevents duplicates)
    await env.DB.prepare(
      `INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)`
    )
      .bind(follower_id, following_id)
      .run()

    // UNERA follower count logic: degree = edges involving user
    const aCount = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ? OR following_id = ?`
    )
      .bind(follower_id, follower_id)
      .first()

    const bCount = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ? OR following_id = ?`
    )
      .bind(following_id, following_id)
      .first()

    return new Response(
      JSON.stringify({
        success: true,
        follower_count: Number(aCount?.c ?? 0),
        following_user_follower_count: Number(bCount?.c ?? 0)
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    )
  } catch (e: any) {
    if (e.message?.includes("UNIQUE") || e.message?.includes("PRIMARY")) {
      return new Response(
        JSON.stringify({ error: "Already following" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      )
    }
    if (e.message?.includes("FOREIGN KEY")) {
      return new Response(
        JSON.stringify({ error: "Invalid follower_id or following_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

export const onRequestDelete: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url)
    const follower_id = url.searchParams.get("follower_id")
    const following_id = url.searchParams.get("following_id")

    if (!follower_id || !following_id) {
      return new Response(
        JSON.stringify({ error: "follower_id and following_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const result = await env.DB.prepare(
      `DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?`
    )
      .bind(follower_id, following_id)
      .run()

    // If nothing deleted, relationship didn't exist
    if ((result.meta?.changes ?? 0) === 0) {
      return new Response(
        JSON.stringify({ error: "Follow relationship not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    const aCount = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ? OR following_id = ?`
    )
      .bind(follower_id, follower_id)
      .first()

    const bCount = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ? OR following_id = ?`
    )
      .bind(following_id, following_id)
      .first()

    return new Response(
      JSON.stringify({
        success: true,
        follower_count: Number(aCount?.c ?? 0),
        following_user_follower_count: Number(bCount?.c ?? 0)
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  // Get follower count (UNERA logic) and follow status
  const url = new URL(request.url)
  const user_id = url.searchParams.get("user_id")
  const viewer_id = url.searchParams.get("viewer_id") // optional: to check if viewer follows user

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: "user_id is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ? OR following_id = ?`
  )
    .bind(user_id, user_id)
    .first()

  let isFollowing = false
  if (viewer_id) {
    const rel = await env.DB.prepare(
      `SELECT 1 as ok FROM user_follows WHERE follower_id = ? AND following_id = ? LIMIT 1`
    )
      .bind(viewer_id, user_id)
      .first()
    isFollowing = !!rel
  }

  return new Response(
    JSON.stringify({
      user_id: Number(user_id),
      follower_count: Number(countRow?.c ?? 0),
      is_followed_by_viewer: isFollowing
    }),
    { headers: { "Content-Type": "application/json" } }
  )
}
