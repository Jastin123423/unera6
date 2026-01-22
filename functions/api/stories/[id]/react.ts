// functions/api/stories/[id]/react.ts
import type { PagesFunction } from "@cloudflare/workers-types";
type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const storyId = toInt((params as any)?.id, 0);
    if (!storyId) return json({ error: "Invalid story id" }, 400);

    const body = await request.json().catch(() => ({} as any));
    const userId = toInt(body.user_id, 0);
    if (!userId) return json({ error: "user_id is required" }, 400);

    // check if already liked
    const existing = await env.DB.prepare(
      `SELECT id FROM story_reactions WHERE story_id = ? AND user_id = ? LIMIT 1`
    )
      .bind(storyId, userId)
      .first();

    if (existing?.id) {
      // unlike
      await env.DB.prepare(`DELETE FROM story_reactions WHERE story_id = ? AND user_id = ?`)
        .bind(storyId, userId)
        .run();
    } else {
      // like
      await env.DB.prepare(`INSERT INTO story_reactions (story_id, user_id) VALUES (?, ?)`)
        .bind(storyId, userId)
        .run();
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as likes_count FROM story_reactions WHERE story_id = ?`
    )
      .bind(storyId)
      .first();

    return json({
      success: true,
      liked: existing?.id ? false : true,
      likes_count: Number((countRow as any)?.likes_count ?? 0),
    });
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};
