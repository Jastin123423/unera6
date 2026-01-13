

// @google/genai-api-fix: Using 'any' as 'PagesFunction' is not globally defined in this environment.
export const onRequestOptions: any = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  })
}

// @google/genai-api-fix: Using 'any' as 'PagesFunction' is not globally defined in this environment.
export const onRequestGet: any = async ({ env }: any) => {
  try {
    const { results } = await (env as any).DB
      .prepare("SELECT * FROM podcasts ORDER BY created_at DESC")
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

// @google/genai-api-fix: Using 'any' as 'PagesFunction' is not globally defined in this environment.
export const onRequestPost: any = async ({ request, env }: any) => {
  try {
    const body: any = await request.json();
    const { creator_id, title, host, thumbnail, audio_url } = body;

    if (!creator_id || !title || !audio_url) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const result = await (env as any).DB.prepare(`
      INSERT INTO podcasts (creator_id, title, host, thumbnail, audio_url)
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(creator_id, title, host || "Unknown Host", thumbnail || null, audio_url)
      .run();

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
