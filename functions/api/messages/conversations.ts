// functions/api/messages/conversations.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const safeNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const getAuthUserId = async (request: Request): Promise<number> => {
  // TEMP testing header (remove once JWT auth wired)
  const hdr = request.headers.get("x-user-id");
  const id = safeNum(hdr, 0);
  return id > 0 ? id : 0;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const userId = await getAuthUserId(request);
    if (!userId) return json({ success: false, error: "Unauthorized: missing user id" }, 401);

    /**
     * We treat a "DM conversation" as any conversation where:
     * - current user is a participant
     * - there is exactly 1 other participant (the "other user")
     *
     * We also compute:
     * - last_text_preview (latest message text)
     * - unread_count for messages sent by other user with no receipt for current user
     */

    const q = await env.DB.prepare(
      `
      SELECT
        c.id AS id,

        -- pick your ordering timestamp (works if last_message_at exists)
        COALESCE(c.last_message_at, c.created_at) AS last_message_at,

        u.id AS other_user_id,
        u.name AS other_name,
        u.profile_image_url AS other_profile_image_url,

        (
          SELECT COALESCE(m.text_content, '')
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 1
        ) AS last_text_preview,

        (
          SELECT COUNT(*)
          FROM messages m2
          LEFT JOIN message_receipts r
            ON r.message_id = m2.id AND r.user_id = ?
          WHERE m2.conversation_id = c.id
            AND m2.sender_id != ?
            AND r.id IS NULL
        ) AS unread_count

      FROM conversations c

      -- I am a participant
      JOIN conversation_participants me
        ON me.conversation_id = c.id AND me.user_id = ?

      -- the other participant
      JOIN conversation_participants other
        ON other.conversation_id = c.id AND other.user_id != ?

      JOIN users u
        ON u.id = other.user_id

      -- ensure DM (exactly 2 participants)
      WHERE (
        SELECT COUNT(*)
        FROM conversation_participants cp
        WHERE cp.conversation_id = c.id
      ) = 2

      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
      `
    )
      .bind(userId, userId, userId, userId)
      .all();

    return json(q.results || []);
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Server error" }, 500);
  }
};
