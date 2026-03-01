import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
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
  // TEMP testing. Later replace with JWT.
  const hdr = request.headers.get("x-user-id");
  const id = safeNum(hdr, 0);
  return id > 0 ? id : 0;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const userId = await getAuthUserId(request);
    if (!userId) return json({ success: false, error: "Unauthorized" }, 401);

    const conversationId = safeNum((params as any)?.id, 0);
    if (!conversationId) return json({ success: false, error: "Invalid conversation id" }, 400);

    // must be participant
    const chk = await env.DB
      .prepare(`SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1`)
      .bind(conversationId, userId)
      .first();

    if (!chk) return json({ success: false, error: "Forbidden" }, 403);

    // fetch messages, excluding ones "deleted for me"
    const rows = await env.DB
      .prepare(
        `
        SELECT
          m.id,
          m.conversation_id,
          m.sender_id,
          m.parent_message_id,
          m.text_content,
          m.attachment_url,
          m.attachment_type,
          m.attachment_metadata,
          m.created_at,
          m.edited_at
        FROM messages m
        LEFT JOIN message_deletes md
          ON md.message_id = m.id AND md.user_id = ?
        WHERE m.conversation_id = ?
          AND md.message_id IS NULL
        ORDER BY m.created_at ASC, m.id ASC
        `
      )
      .bind(userId, conversationId)
      .all();

    return json(rows.results || []);
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Server error" }, 500);
  }
};
