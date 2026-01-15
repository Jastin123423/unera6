const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  const post_id = Number((params as any)?.id);
  if (!post_id) return Response.json({ error: "Invalid post id" }, { status: 400, headers: cors });

  const body = await request.json().catch(() => ({} as any));
  const user_id = Number(body.user_id ?? 0); // if you want guest reactions, allow null instead
  const type = String(body.type || "like");

  if (!user_id) return Response.json({ error: "user_id is required" }, { status: 400, headers: cors });

  await env.DB.prepare(
    `INSERT OR REPLACE INTO post_reactions (post_id, user_id, type) VALUES (?, ?, ?)`
  ).bind(post_id, user_id, type).run();

  return Response.json({ success: true }, { status: 200, headers: cors });
};
