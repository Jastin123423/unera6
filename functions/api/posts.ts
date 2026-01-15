const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return Response.json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        { status: 500, headers: corsHeaders }
      );
    }

    const body = await request.json().catch(() => ({} as any));
    const content = (body.content ?? "").toString().trim();
    const media_url = body.media_url ?? null;
    const media_type = body.media_type ?? null;

    // Allow guest posts
    const user_id = body.user_id ?? null;

    if (!content && !media_url) {
      return Response.json(
        { error: "content or media_url is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // ✅ REQUIRED BY YOU
    const created_at = new Date().toISOString();

    const result = await env.DB.prepare(
      `INSERT INTO posts (user_id, content, media_url, media_type, created_at, shares, views)
       VALUES (?, ?, ?, ?, ?, 0, 0)`
    )
      .bind(user_id, content || null, media_url, media_type, created_at)
      .run();

    return Response.json(
      { success: true, post_id: result.meta?.last_row_id },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: any) {
    return Response.json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      { status: 500, headers: corsHeaders }
    );
  }
};

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return Response.json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        { status: 500, headers: corsHeaders }
      );
    }

    const url = new URL(request.url);
    const limit = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get("limit") || 50))
    );

    const { results } = await env.DB
      .prepare("SELECT * FROM posts ORDER BY created_at DESC LIMIT ?")
      .bind(limit)
      .all();

    return Response.json(
      Array.isArray(results) ? results : [],
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return Response.json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      { status: 500, headers: corsHeaders }
    );
  }
};
