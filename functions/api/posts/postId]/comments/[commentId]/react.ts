

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  try {
    const postId = Number((params as any)?.postId);
    const commentId = Number((params as any)?.commentId);

    if (!postId || !commentId) {
      return Response.json({ error: "Invalid postId/commentId" }, { status: 400, headers: cors });
    }

    const body = await request.json().catch(() => ({} as any));
    const userId = Number(body?.user_id);
    const type = String(body?.type || "like").toLowerCase();

    if (!userId) return Response.json({ error: "user_id is required" }, { status: 400, headers: cors });
    if (type !== "like") return Response.json({ error: "Only 'like' supported" }, { status: 400, headers: cors });

    // ✅ Make sure table exists: comment_reactions(comment_id, user_id, type, created_at)
    // Toggle logic: if exists => remove, else => insert
    const existing = await env.DB.prepare(
      `SELECT id FROM comment_reactions WHERE comment_id = ? AND user_id = ? LIMIT 1`
    ).bind(commentId, userId).first();

    if (existing?.id) {
      await env.DB.prepare(`DELETE FROM comment_reactions WHERE id = ?`).bind(existing.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO comment_reactions (comment_id, user_id, type) VALUES (?, ?, ?)`
      ).bind(commentId, userId, "like").run();
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM comment_reactions WHERE comment_id = ?`
    ).bind(commentId).first();

    const reactions_count = Number((countRow as any)?.c ?? 0) || 0;
    const my_reaction = existing?.id ? null : "like";

    return Response.json(
      { success: true, comment_id: commentId, reactions_count, my_reaction },
      { status: 200, headers: cors }
    );
  } catch (e: any) {
    return Response.json({ error: 
