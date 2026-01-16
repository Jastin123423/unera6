const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction = async ({ env, params }) => {
  try {
    const postId = Number((params as any)?.id);
    if (!postId) return Response.json({ error: "Invalid post id" }, { status: 400, headers: cors });

    const { results } = await env.DB.prepare(
      `SELECT pc.id, pc.post_id, pc.user_id, pc.text, pc.created_at,
              u.username as author_name, u.profile_image_url as author_image
       FROM post_comments pc
       LEFT JOIN users u ON u.id = pc.user_id
       WHERE pc.post_id = ?
       ORDER BY pc.created_at ASC`
    ).bind(postId).all();

    return Response.json(Array.isArray(results) ? results : [], { status: 200, headers: cors });
  } catch (err: any) {
    return Response.json({ error: "Backend crash", message: String(err?.message ?? err) }, { status: 500, headers: cors });
  }
};
