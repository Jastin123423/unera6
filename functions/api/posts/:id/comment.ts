const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  try {
    const postId = Number((params as any)?.id);
    if (!postId) return Response.json({ error: "Invalid post id" }, { status: 400, headers: cors });

    const body = await request.json().catch(() => ({} as any));
    const text = String(body.text ?? "").trim();
    const user_id = body.user_id ?? null; // allow guest comment if you want

    if (!text) return Response.json({ error: "text is required" }, { status: 400, headers: cors });

    const result = await env.DB.prepare(
      `INSERT INTO post_comments (post_id, user_id, text) VALUES (?, ?, ?)`
    ).bind(postId, user_id, text).run();

    const comment = {
      id: result.meta?.last_row_id,
      post_id: postId,
      user_id,
      text,
      created_at: new Date().toISOString(),
    };

    return Response.json({ success: true, comment }, { status: 201, headers: cors });
  } catch (err: any) {
    return Response.json({ error: "Backend crash", message: String(err?.message ?? err) }, { status: 500, headers: cors });
  }
};
