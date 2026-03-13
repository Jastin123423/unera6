import type { PagesFunction } from "@cloudflare/workers-types";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const json = (data: any, status = 200) =>
  Response.json(data, { status, headers: cors });

const toInt = (v: any) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normType = (v: any) => String(v ?? "like").trim().toLowerCase() || "like";

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  try {
    const post_id = toInt((params as any)?.id);
    if (!post_id) return json({ error: "Invalid post id" }, 400);

    const body = await request.json().catch(() => ({} as any));
    const user_id = toInt(body?.user_id);
    const type = normType(body?.type);

    if (!user_id) return json({ error: "user_id is required" }, 400);

    // 1) Read existing reaction for this user/post
    const existing = await env.DB.prepare(
      `SELECT type FROM post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1`
    )
      .bind(post_id, user_id)
      .first();

    const existingType = existing ? normType((existing as any).type) : null;

    // 2) Toggle logic:
    // - same type => remove
    // - different type => upsert update
    let action: "added" | "updated" | "removed" = "added";
    let my_reaction: string | null = type;

    if (existingType && existingType === type) {
      await env.DB.prepare(
        `DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?`
      )
        .bind(post_id, user_id)
        .run();

      action = "removed";
      my_reaction = null;
    } else {
      await env.DB.prepare(
        `INSERT INTO post_reactions (post_id, user_id, type)
         VALUES (?, ?, ?)
         ON CONFLICT(post_id, user_id) DO UPDATE SET
           type = excluded.type`
      )
        .bind(post_id, user_id, type)
        .run();

      action = existingType ? "updated" : "added";
      my_reaction = type;
    }

    // 3) Server truth: count reactions for this post
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM post_reactions WHERE post_id = ?`
    )
      .bind(post_id)
      .first();

    const reactions_count = toInt((countRow as any)?.c);

    // ✅ Return server truth so App.tsx can never "flip back"
    return json({
      success: true,
      action,
      post_id,
      user_id,
      type, // normalized input type
      my_reaction, // the user's current reaction after toggle
      reactions_count, // total reactions for this post
    });
  } catch (e: any) {
    return json({ error: e?.message || "Reaction failed" }, 500);
  }
};
