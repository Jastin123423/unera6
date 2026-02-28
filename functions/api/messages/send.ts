// functions/api/messages/send.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const safeStr = (v: any) => (typeof v === "string" ? v : "");
const safeNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const getAuthUserId = async (request: Request): Promise<number> => {
  const hdr = request.headers.get("x-user-id");
  const id = safeNum(hdr, 0);
  return id > 0 ? id : 0;
};

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));

    const authUserId = await getAuthUserId(request);
    const senderId = authUserId || safeNum(body.sender_id, 0); // fallback if you’re not doing auth yet
    const recipientId = safeNum(body.recipient_id, 0);

    const textContent = safeStr(body.text_content || body.text || "").trim();
    const attachmentUrl = safeStr(body.attachment_url || "");
    const attachmentType = safeStr(body.attachment_type || "");
    const attachmentMetadata = body.attachment_metadata ? JSON.stringify(body.attachment_metadata) : null;

    if (!senderId || !recipientId) return json({ success: false, error: "Missing sender_id/recipient_id" }, 400);
    if (senderId === recipientId) return json({ success: false, error: "Cannot message yourself" }, 400);
    if (!textContent && !attachmentUrl) return json({ success: false, error: "Missing text or attachment" }, 400);

    // Find existing DM conversation between sender & recipient:
    const existing = await env.DB.prepare(
      `
      SELECT c.id AS id
      FROM conversations c
      JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
      JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
      WHERE c.is_group = 0
      LIMIT 1
      `
    )
      .bind(senderId, recipientId)
      .first();

    let conversationId = safeNum((existing as any)?.id, 0);

    // If not exists, create conversation + participants
    if (!conversationId) {
      const cRes = await env.DB.prepare(
        `INSERT INTO conversations (is_group, last_message_at) VALUES (0, CURRENT_TIMESTAMP)`
      ).run();

      conversationId = safeNum(cRes.lastInsertRowid, 0);
      if (!conversationId) return json({ success: false, error: "Failed to create conversation" }, 500);

      await env.DB.prepare(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)`
      )
        .bind(conversationId, senderId, conversationId, recipientId)
        .run();
    }

    // Insert message
    const mRes = await env.DB.prepare(
      `
      INSERT INTO messages
      (conversation_id, sender_id, parent_message_id, text_content, attachment_url, attachment_type, attachment_metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        conversationId,
        senderId,
        body.parent_message_id ? safeNum(body.parent_message_id, 0) : null,
        textContent || null,
        attachmentUrl || null,
        attachmentType || null,
        attachmentMetadata
      )
      .run();

    const messageId = safeNum(mRes.lastInsertRowid, 0);

    // Update conversation last_message_at
    await env.DB.prepare(`UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(conversationId)
      .run();

    // Return the inserted message row in the shape frontend expects
    const msg = await env.DB.prepare(
      `
      SELECT
        id, conversation_id, sender_id, parent_message_id,
        text_content, attachment_url, attachment_type, attachment_metadata, created_at
      FROM messages
      WHERE id = ?
      LIMIT 1
      `
    )
      .bind(messageId)
      .first();

    return json(msg || { id: messageId, conversation_id: conversationId, sender_id: senderId, text_content: textContent });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Server error" }, 500);
  }
};
