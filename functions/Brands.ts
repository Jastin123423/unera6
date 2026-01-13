
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  })
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json() as any;
    const { owner_id, name, description, logo_url, category } = body;

    if (!owner_id || !name) {
      return new Response("Missing required fields", { status: 400 });
    }

    const result = await (env as any).DB
      .prepare(`
        INSERT INTO brands
        (owner_id, name, description, logo_url, category)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        owner_id,
        name,
        description ?? null,
        logo_url ?? null,
        category ?? null
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        brand_id: result.meta.last_row_id
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    )
  }
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  try {
    const { results } = await (env as any).DB
      .prepare("SELECT * FROM brands ORDER BY created_at DESC")
      .all();

    return new Response(JSON.stringify(results), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
