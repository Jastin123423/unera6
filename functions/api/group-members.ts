export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    // 1️⃣ Parse body
    const body = await request.json()
    const { group_id, user_id, role } = body

    // 2️⃣ Validate input
    if (!group_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "group_id and user_id are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // 3️⃣ Insert member
    await env.DB.prepare(
      `
      INSERT INTO group_members (group_id, user_id, role)
      VALUES (?, ?, ?)
      `
    )
      .bind(group_id, user_id, role ?? "member")
      .run()

    // 4️⃣ Success
    return new Response(
      JSON.stringify({
        success: true,
        message: "User added to group"
      }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (e: any) {
    // 🔁 Handle duplicate membership
    if (e.message?.includes("UNIQUE")) {
      return new Response(
        JSON.stringify({ error: "User already in this group" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      )
    }

    // 🔁 Handle foreign key issues
    if (e.message?.includes("FOREIGN KEY")) {
      return new Response(
        JSON.stringify({ error: "Invalid group_id or user_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // ❌ Unknown error
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
