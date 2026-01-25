//. functions/api/group-members.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server, json } from "./_cors";

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

// JOIN
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const group_id = Number(body.group_id || 0);
    const user_id = Number(body.user_id || 0);
    const role = String(body.role || "member").trim();

    if (!group_id || !user_id) return bad("group_id and user_id are required");

    await env.DB.prepare(
      `INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`
    )
      .bind(group_id, user_id, role)
      .run();

    return ok({ message: "User added to group" });
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("UNIQUE")) return bad("User already in this group", 409);
    if (msg.includes("FOREIGN KEY")) return bad("Invalid group_id or user_id", 400);
    return server(msg || "Failed to join group");
  }
};

// LIST members: /api/group-members?group_id=123
export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const group_id = Number(url.searchParams.get("group_id") || 0);
    if (!group_id) return bad("group_id is required");

    const { results } = await env.DB.prepare(
      `SELECT gm.user_id, gm.role, gm.created_at,
              u.username, u.name, u.profile_image_url, u.is_verified, u.role as user_role
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY gm.created_at DESC`
    )
      .bind(group_id)
      .all();

    return ok({ members: results || [] });
  } catch (e: any) {
    return server(e?.message || "Failed to fetch members");
  }
};

// LEAVE: /api/group-members?group_id=123&user_id=4
export const onRequestDelete: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const group_id = Number(url.searchParams.get("group_id") || 0);
    const user_id = Number(url.searchParams.get("user_id") || 0);

    if (!group_id || !user_id) return bad("group_id and user_id are required");

    await env.DB.prepare(
      `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`
    )
      .bind(group_id, user_id)
      .run();

    return ok({ message: "User removed from group" });
  } catch (e: any) {
    return server(e?.message || "Failed to leave group");
  }
};
