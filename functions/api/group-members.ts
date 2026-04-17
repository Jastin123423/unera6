import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server } from "./_cors";
import { createNotification } from "../utils/createNotification";

type Env = { DB: D1Database };

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/**
 * JOIN: POST /api/group-members
 * body: { group_id, user_id, role? }
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const headerUserId = toNum(request.headers.get("x-user-id"), 0);
    const bodyUserId = toNum(body.user_id, 0);
    const user_id = headerUserId || bodyUserId || 0;

    const group_id = toNum(body.group_id, 0);
    const role = String(body.role || "member").trim().toLowerCase();

    if (!group_id || !user_id) return bad("group_id and user_id are required");
    if (!(role === "admin" || role === "member")) {
      return bad("role must be admin or member");
    }

    // Ensure group exists and get admin
    const group = await env.DB.prepare(
      `SELECT id, admin_id
       FROM groups
       WHERE id = ?
       LIMIT 1`
    )
      .bind(group_id)
      .first();

    if (!group) return bad("Group not found", 404);

    // Check if already a member before insert
    const existing = await env.DB.prepare(
      `SELECT 1
       FROM group_members
       WHERE group_id = ? AND user_id = ?
       LIMIT 1`
    )
      .bind(group_id, user_id)
      .first();

    // Idempotent join
    await env.DB.prepare(
      `INSERT OR IGNORE INTO group_members (group_id, user_id, role)
       VALUES (?, ?, ?)`
    )
      .bind(group_id, user_id, role)
      .run();

    // Only increment count and notify if this was a real new join
    if (!existing) {
      // keep groups.members_count in sync
      await env.DB.prepare(
        `UPDATE groups
         SET members_count = COALESCE(members_count, 0) + 1
         WHERE id = ?`
      )
        .bind(group_id)
        .run();

      const adminId = toNum((group as any).admin_id, 0);

      if (adminId && adminId !== user_id) {
        await createNotification(
          env,
          adminId,
          user_id,
          "group_request",
          "group",
          group_id,
          `group:${group_id}:member_join:${user_id}`,
          "joined your group"
        );
      }
    }

    return ok({
      success: true,
      message: existing ? "User is already a member" : "User added to group",
      already_member: !!existing,
    });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("FOREIGN KEY")) return bad("Invalid group_id or user_id", 400);
    return server(msg || "Failed to join group");
  }
};

/**
 * LIST: GET /api/group-members?group_id=123
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const group_id = toNum(url.searchParams.get("group_id"), 0);
    if (!group_id) return bad("group_id is required");

    const { results } = await env.DB.prepare(
      `SELECT
         gm.user_id,
         gm.role,
         gm.joined_at,
         u.username,
         u.name,
         u.profile_image_url,
         u.is_verified,
         u.role AS user_role
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.joined_at DESC`
    )
      .bind(group_id)
      .all();

    return ok({ members: results || [] });
  } catch (e: any) {
    return server(e?.message || "Failed to fetch members");
  }
};

/**
 * LEAVE / REMOVE: DELETE /api/group-members?group_id=123&user_id=4
 */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const group_id = toNum(url.searchParams.get("group_id"), 0);
    const user_id = toNum(url.searchParams.get("user_id"), 0);

    if (!group_id || !user_id) return bad("group_id and user_id are required");

    // prevent admin from leaving their own group
    const g = await env.DB.prepare(
      `SELECT admin_id
       FROM groups
       WHERE id = ?
       LIMIT 1`
    )
      .bind(group_id)
      .first();

    if (!g) return bad("Group not found", 404);

    if (toNum((g as any).admin_id, 0) === user_id) {
      return bad("Group admin cannot leave. Delete group or transfer admin.", 400);
    }

    // check if member exists first
    const existing = await env.DB.prepare(
      `SELECT 1
       FROM group_members
       WHERE group_id = ? AND user_id = ?
       LIMIT 1`
    )
      .bind(group_id, user_id)
      .first();

    if (!existing) {
      return ok({
        success: true,
        message: "User was not a member",
        already_removed: true,
      });
    }

    await env.DB.prepare(
      `DELETE FROM group_members
       WHERE group_id = ? AND user_id = ?`
    )
      .bind(group_id, user_id)
      .run();

    // decrement members_count safely
    await env.DB.prepare(
      `UPDATE groups
       SET members_count = CASE
         WHEN COALESCE(members_count, 0) > 0 THEN members_count - 1
         ELSE 0
       END
       WHERE id = ?`
    )
      .bind(group_id)
      .run();

    return ok({
      success: true,
      message: "User removed from group",
      already_removed: false,
    });
  } catch (e: any) {
    return server(e?.message || "Failed to leave group");
  }
};
