// functions/api/messages/send.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const safeStr = (v: any) => (typeof v === "string" ? v : "");
const safeNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const getInsertedId = (res: any) =>
  safeNum(res?.meta?.last_row_id ?? res?.lastInsertRowid ?? res?.last_row_id ?? 0, 0);

const getAuthUserId = async (request: Request): Promise<number> => {
  const hdr = request.headers.get("x-user-id");
  const id = safeNum(hdr, 0);
  return id > 0 ? id : 0;
};

const normalizeAttachments = (body: any) => {
  // New format: attachments: [{url, file_type, mime_type, filename, size_bytes, metadata, ...}]
  const arr = Array.isArray(body?.attachments) ? body.attachments : [];
  const cleaned = arr
    .map((a: any) => ({
      url: safeStr(a?.url ?? "").trim(),
      file_type: safeStr(a?.file_type ?? a?.type ?? "other").trim(),
      mime_type: safeStr(a?.mime_type ?? a?.mime ?? "").trim(),
      filename: safeStr(a?.filename ?? "").trim(),
      size_bytes: a?.size_bytes != null ? safeNum(a.size_bytes, 0) : null,
      width: a?.width != null ? safeNum(a.width, 0) : null,
      height: a?.height != null ? safeNum(a.height, 0) : null,
      duration_ms: a?.duration_ms != null ? safeNum(a.duration_ms, 0) : null,
      page_count: a?.page_count != null ? safeNum(a.page_count, 0) : null,
      metadata:
        a?.metadata != null
          ? typeof a.metadata === "string"
            ? a.metadata
            : JSON.stringify(a.metadata)
          : null,
    }))
    .filter((a: any) => !!a.url);

  // Backward compatibility: single attachment_url
  const legacyUrl = safeStr(body?.attachment_url ?? "").trim();
  const legacyType = safeStr(body?.attachment_type ?? "").trim();
  const legacyMeta =
    body?.attachment_metadata != null
      ? typeof body.attachment_metadata === "string"
        ? body.attachment_metadata
        : JSON.stringify(body.attachment_metadata)
      : null;

  // If no attachments[] provided but legacy exists, convert it to one attachment row too
  if (!cleaned.length && legacyUrl) {
    cleaned.push({
      url: legacyUrl,
      file_type: legacyType || "other",
      mime_type: "",
      filename: "",
      size_bytes: null,
      width: null,
      height: null,
      duration_ms: null,
      page_count: null,
      metadata: legacyMeta,
    });
  }

  return cleaned;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));

    const authUserId = await getAuthUserId(request);
    const senderId = authUserId || safeNum(body.sender_id, 0);
    const recipientId = safeNum(body.recipient_id, 0);

    const textContent = safeStr(body.text_content ?? body.text ?? "").trim();
    const parentMessageId = body.parent_message_id != null ? safeNum(body.parent_message_id, 0) : null;

    const attachments = normalizeAttachments(body);

    if (!senderId || !recipientId) return json({ success: false, error: "Missing sender_id/recipient_id" }, 400);
    if (senderId === recipientId) return json({ success: false, error: "Cannot message yourself" }, 400);
    if (!textContent && attachments.length === 0)
      return json({ success: false, error: "Missing text or attachment(s)" }, 400);

    // 1) Find existing DM conversation between these 2 users
    const existing = await env.DB
      .prepare(
        `
        SELECT c.id AS id
        FROM conversations c
        JOIN conversation_participants p1
          ON p1.conversation_id = c.id AND p1.user_id = ?
        JOIN conversation_participants p2
          ON p2.conversation_id = c.id AND p2.user_id = ?
        LIMIT 1
      `
      )
      .bind(senderId, recipientId)
      .first();

    let conversationId = safeNum((existing as any)?.id, 0);

    // 2) Create conversation if missing
    if (!conversationId) {
      const cRes = await env.DB.prepare(`INSERT INTO conversations DEFAULT VALUES`).run();
      conversationId = getInsertedId(cRes);
      if (!conversationId) return json({ success: false, error: "Failed to create conversation (no id returned)" }, 500);

      await env.DB
        .prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)`)
        .bind(conversationId, senderId, conversationId, recipientId)
        .run();

      try {
        await env.DB.prepare(`UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(conversationId)
          .run();
      } catch {}
    }

    // 3) Insert message (keep old single columns set for compatibility)
    const firstAtt = attachments[0] || null;

    const mRes = await env.DB
      .prepare(
        `
        INSERT INTO messages
          (conversation_id, sender_id, parent_message_id, text_content, attachment_url, attachment_type, attachment_metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        conversationId,
        senderId,
        parentMessageId,
        textContent || null,
        firstAtt ? firstAtt.url : null,
        firstAtt ? firstAtt.file_type : null,
        firstAtt ? firstAtt.metadata : null
      )
      .run();

    const messageId = getInsertedId(mRes);

    // 4) Insert attachments into message_attachments (supports multiple)
    if (messageId && attachments.length) {
      const stmt = env.DB.prepare(
        `
        INSERT INTO message_attachments
          (message_id, url, mime_type, file_type, filename, size_bytes, width, height, duration_ms, page_count, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      );

      for (const a of attachments) {
        await stmt
          .bind(
            messageId,
            a.url,
            a.mime_type || null,
            a.file_type || "other",
            a.filename || null,
            a.size_bytes,
            a.width,
            a.height,
            a.duration_ms,
            a.page_count,
            a.metadata
          )
          .run();
      }
    }

    // 5) Update conversation last_message_at (best-effort)
    try {
      await env.DB.prepare(`UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(conversationId)
        .run();
    } catch {}

    // 6) Return inserted message + attachments
    const msg = await env.DB
      .prepare(
        `
        SELECT
          id, conversation_id, sender_id, parent_message_id,
          text_content, attachment_url, attachment_type, attachment_metadata,
          created_at, edited_at
        FROM messages
        WHERE id = ?
        LIMIT 1
      `
      )
      .bind(messageId)
      .first();

    const attRows = await env.DB
      .prepare(`SELECT * FROM message_attachments WHERE message_id = ? ORDER BY id ASC`)
      .bind(messageId)
      .all();

    return json({ success: true, message: msg, attachments: attRows.results || [] });
  } catch (e: any) {
    return json({ success: false, error: e?.message || "Server error" }, 500);
  }
};
