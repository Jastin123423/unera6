const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ env, params }) => {
  try {
    const postId = Number((params as any)?.id);
    if (!postId) return Response.json({ error: "Invalid post id" }, { status: 400, headers: cors });

    // posts.shares must exist (you already added it)
    await env.DB.prepare(`UPDATE posts SET shares = COALESCE(shares,0) + 1 WHERE id = ?`)
      .bind(postId)
      .run();

    return Response.json({ success: true }, { status: 200, headers: cors });
  } catch (err: any) {
    return Response.json({ error: "Backend crash", message: String(err?.message ?? err) }, { status: 500, headers: cors });
  }
};
