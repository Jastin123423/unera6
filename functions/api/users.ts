export async function onRequest(context: any) {
  const { request, env } = context
  const method = request.method
  const url = new URL(request.url)

  try {
    // ================================
    // CREATE USER
    // ================================
    if (method === "POST") {
      const {
        username,
        email,
        password_hash,
        bio,
        location
      } = await request.json()

      if (!username || !email || !password_hash) {
        return new Response(
          JSON.stringify({ error: "username, email and password_hash are required" }),
          { status: 400 }
        )
      }

      const result = await env.DB
        .prepare(`
          INSERT INTO users (username, email, password_hash, bio, location, joined_date)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(username, email, password_hash, bio ?? null, location ?? null)
        .run()

      return new Response(
        JSON.stringify({ success: true, user_id: result.meta.last_row_id }),
        { status: 201 }
      )
    }

    // ================================
    // GET USER
    // ================================
    if (method === "GET") {
      const id = url.searchParams.get("id")
      const username = url.searchParams.get("username")

      let query, param

      if (id) {
        query = "SELECT * FROM users WHERE id = ?"
        param = id
      } else if (username) {
        query = "SELECT * FROM users WHERE username = ?"
        param = username
      } else {
        return new Response(
          JSON.stringify({ error: "Provide id or username" }),
          { status: 400 }
        )
      }

      const user = await env.DB
        .prepare(query)
        .bind(param)
        .first()

      if (!user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404 }
        )
      }

      // Never return password hash
      delete user.password_hash

      return new Response(JSON.stringify(user), {
        headers: { "Content-Type": "application/json" }
      })
    }

    // ================================
    // UPDATE USER
    // ================================
    if (method === "PUT") {
      const {
        id,
        bio,
        work,
        education,
        website,
        profile_image_url,
        cover_image_url
      } = await request.json()

      if (!id) {
        return new Response(
          JSON.stringify({ error: "User id required" }),
          { status: 400 }
        )
      }

      await env.DB
        .prepare(`
          UPDATE users SET
            bio = COALESCE(?, bio),
            work = COALESCE(?, work),
            education = COALESCE(?, education),
            website = COALESCE(?, website),
            profile_image_url = COALESCE(?, profile_image_url),
            cover_image_url = COALESCE(?, cover_image_url)
          WHERE id = ?
        `)
        .bind(
          bio ?? null,
          work ?? null,
          education ?? null,
          website ?? null,
          profile_image_url ?? null,
          cover_image_url ?? null,
          id
        )
        .run()

      return new Response(JSON.stringify({ success: true }))
    }

    // ================================
    // DELETE USER
    // ================================
    if (method === "DELETE") {
      const id = url.searchParams.get("id")

      if (!id) {
        return new Response(
          JSON.stringify({ error: "User id required" }),
          { status: 400 }
        )
      }

      await env.DB
        .prepare("DELETE FROM users WHERE id = ?")
        .bind(id)
        .run()

      return new Response(JSON.stringify({ success: true }))
    }

    // ================================
    // METHOD NOT ALLOWED
    // ================================
    return new Response("Method Not Allowed", { status: 405 })

  } catch (e: any) {
    if (e.message.includes("UNIQUE")) {
      return new Response(
        JSON.stringify({ error: "Username or email already exists" }),
        { status: 409 }
      )
    }

    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500 }
    )
  }
}
