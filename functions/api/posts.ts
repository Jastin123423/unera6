export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return Response.json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({} as any));
    const content = (body.content ?? "").toString().trim();
    const media_url = body.media_url ?? null;
    const media_type = body.media_type ?? null;

    // Allow guest posts: user_id can be null
    const user_id = body.user_id ?? null;

    if (!content && !media_url) {
      return Response.json(
        { error: "content or media_url is required" },
        { status: 400 }
      );
    }

    const result = await env.DB.prepare(
      `INSERT INTO posts (user_id, content, media_url, media_type)
       VALUES (?, ?, ?, ?)`
    )
      .bind(user_id, content || null, media_url, media_type)
      .run();

    return Response.json(
      { success: true, post_id: result.meta?.last_row_id },
      { status: 201 }
    );
  } catch (err: any) {
    return Response.json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
};

export const onRequestGet: PagesFunction = async ({ env }) => {
  try {
    if (!env.DB) {
      return Response.json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        { status: 500 }
      );
    }

    const { results } = await env.DB.prepare(
      "SELECT * FROM posts ORDER BY created_at DESC"
    ).all();

    return Response.json(results, { status: 200 });
  } catch (err: any) {
    return Response.json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      { status: 500 }
    );
  }
};
