// functions/api/posts/[id]/comment.ts
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  try {
    // ✅ safer post id validation
    const postIdRaw = (params as any)?.id;
    const postId = Number(postIdRaw);

    if (!Number.isFinite(postId) || postId <= 0) {
      return Response.json({ error: "Invalid post id" }, { status: 400, headers: cors });
    }

    const body = await request.json().catch(() => ({} as any));

    const text = String(body.text ?? "").trim();
    const userId = Number(body.user_id);

    if (!text) {
      return Response.json({ error: "text is required" }, { status: 400, headers: cors });
    }

    // ✅ require login for comments (prevents Anonymous)
    if (!Number.isFinite(userId) || userId <= 0) {
      return Response.json({ error: "user_id is required" }, { status: 400, headers: cors });
    }

    // ✅ insert
    const insert = await env.DB.prepare(
      `INSERT INTO post_comments (post_id, user_id, text) VALUES (?, ?, ?)`
    )
      .bind(postId, userId, text)
      .run();

    const insertedId = Number(insert.meta?.last_row_id);

    if (!Number.isFinite(insertedId) || insertedId <= 0) {
      return Response.json({ error: "Failed to create comment" }, { status: 500, headers: cors });
    }

    // ✅ return full comment with author fields (no waiting / no "Anonymous")
    const comment = await env.DB.prepare(
      `SELECT pc.id, pc.post_id, pc.user_id, pc.text, pc.created_at,
              u.username as author_name, u.profile_image_url as author_image
       FROM post_comments pc
       LEFT JOIN users u ON u.id = pc.user_id
       WHERE pc.id = ?`
    )
      .bind(insertedId)
      .first();

    return Response.json(
      { success: true, comment: comment ?? null },
      { status: 201, headers: cors }
    );
  } catch (err: any) {
    return Response.json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      { status: 500, headers: cors }
    );
  }
};

