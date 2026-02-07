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

// ✅ You can add more any time
const ALLOWED_REACTIONS = new Set([
  "like",   // 👍
  "fire",   // 🔥
  "love",   // ❤️ / ♥
  "heart_eyes", // 😍
  "couple", // 💏
  "devil",  // 👿
  "angry",  // 😡
  "wow",    // 😮
  "haha",   // 😂
  "sad",    // 😢
]);

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const storyId = toInt((params as any)?.id, 0);
    if (!storyId) return json({ success: false, error: "Invalid story id" }, 400);

    const body = await request.json().catch(() => ({} as any));
    const userId = toInt(body.user_id, 0);
    const reaction = String(body.reaction ?? "").trim(); // e.g. "fire"
    if (!userId) return json({ success: false, error: "user_id is required" }, 400);

    // If reaction is missing -> treat as old toggle-like behavior using "like"
    const chosen = reaction || "like";
    if (!ALLOWED_REACTIONS.has(chosen)) {
      return json(
        { success: false, error: "Invalid reaction", allowed: Array.from(ALLOWED_REACTIONS) },
        400
      );
    }

    // Ensure story exists
    const exists = await env.DB.prepare(`SELECT id FROM stories WHERE id = ? LIMIT 1`)
      .bind(storyId)
      .first();
    if (!exists?.id) return json({ success: false, error: "Story not found" }, 404);

    // Current reaction (if any)
    const existing = await env.DB.prepare(
      `SELECT id, reaction FROM story_reactions WHERE story_id = ? AND user_id = ? LIMIT 1`
    )
      .bind(storyId, userId)
      .first();

    let my_reaction: string | null = null;
    let changed = false;

    if (existing?.id) {
      const prev = String((existing as any).reaction ?? "").trim();

      if (prev === chosen) {
        // same reaction again => remove (toggle off)
        await env.DB.prepare(`DELETE FROM story_reactions WHERE story_id = ? AND user_id = ?`)
          .bind(storyId, userId)
          .run();

        my_reaction = null;
        changed = true;
      } else {
        // different reaction => update
        await env.DB.prepare(
          `UPDATE story_reactions
             SET reaction = ?, updated_at = datetime('now')
           WHERE story_id = ? AND user_id = ?`
        )
          .bind(chosen, storyId, userId)
          .run();

        my_reaction = chosen;
        changed = true;
      }
    } else {
      // create new reaction
      await env.DB.prepare(
        `INSERT INTO story_reactions (story_id, user_id, reaction, updated_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
        .bind(storyId, userId, chosen)
        .run();

      my_reaction = chosen;
      changed = true;
    }

    const totalRow = await env.DB.prepare(
      `SELECT COUNT(*) as reactions_count FROM story_reactions WHERE story_id = ?`
    )
      .bind(storyId)
      .first();

    // Breakdown counts by reaction (handy for UI)
    const { results: breakdown } = await env.DB.prepare(
      `SELECT reaction, COUNT(*) as count
         FROM story_reactions
        WHERE story_id = ?
        GROUP BY reaction`
    )
      .bind(storyId)
      .all();

    return json({
      success: true,
      changed,
      my_reaction,
      reactions_count: Number((totalRow as any)?.reactions_count ?? 0),
      breakdown: Array.isArray(breakdown) ? breakdown : [],
    });
  } catch (err: any) {
    return json({ success: false, error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};
