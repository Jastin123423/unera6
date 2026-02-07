// functions/api/stories/[id]/view.ts
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
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const storyId = toInt((params as any)?.id, 0);
    if (!storyId) return json({ success: false, error: "Invalid story id" }, 400);

    const body = await request.json().catch(() => ({} as any));
    const userId = toInt(body.user_id, 0);
    if (!userId) return json({ success: false, error: "user_id is required" }, 400);

    // Ensure story exists (optional but helps debugging)
    const exists = await env.DB.prepare(`SELECT id FROM stories WHERE id = ? LIMIT 1`)
      .bind(storyId)
      .first();

    if (!exists?.id) return json({ success: false, error: "Story not found" }, 404);

    // ✅ Insert view without throwing on duplicates
    // UNIQUE(story_id, user_id) will prevent duplicates
    const insertRes = await env.DB.prepare(
      `INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?, ?)`
    )
      .bind(storyId, userId)
      .run();

    // D1 returns meta.changes = 1 if inserted, 0 if ignored (already viewed)
    const viewed = Number(insertRes?.meta?.changes ?? 0) > 0;

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as views_count FROM story_views WHERE story_id = ?`
    )
      .bind(storyId)
      .first();

    return json({
      success: true,
      viewed,
      views_count: Number((countRow as any)?.views_count ?? 0),
    });
  } catch (err: any) {
    // ✅ If anything fails, you will SEE it now.
    return json(
      { success: false, error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};
