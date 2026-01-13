export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json()

    const {
      creator_id,
      title,
      description,
      event_date,
      location,
      cover_url
    } = body

    const result = await env.DB
      .prepare(`
        INSERT INTO events
        (creator_id, title, description, event_date, location, cover_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        creator_id,
        title,
        description ?? null,
        event_date,
        location ?? null,
        cover_url ?? null
      )
      .run()

    return new Response(JSON.stringify({
      success: true,
      event_id: result.meta.last_row_id
    }), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || "Unknown error"
      }),
      { status: 500 }
    )
  }
}
