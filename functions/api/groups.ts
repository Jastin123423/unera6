// functions/api/groups.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server, json } from "./_cors";

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const admin_id = Number(body.admin_id || 0);
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const type = String(body.type || "public").trim().toLowerCase();
    const cover_image = body.cover_image ? String(body.cover_image).trim() : null;
    const profile_image = body.profile_image ? String(body.profile_image).trim() : null;

    if (!admin_id) return bad("admin_id is required");
    if (!name) return bad("name is required");
    if (!description) return bad("description is required");
    if (!(type === "public" || type === "private")) return bad("type must be public or private");

    const result = await env.DB.prepare(
      `INSERT INTO groups (admin_id, name, description, type, cover_image, profile_image)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(admin_id, name, description, type, cover_image, profile_image)
      .run();

    const group_id = Number(result.meta.last_row_id);

    // ✅ auto-add admin as member
    await env.DB.prepare(
      `INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')`
    )
      .bind(group_id, admin_id)
      .run();

    return ok({ group_id });
  } catch (e: any) {
    return server(e?.message || "Failed to create group");
  }
};

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const groupId = Number(url.searchParams.get("id") || 0);

    // ✅ DETAILS mode: /api/groups?id=123
    if (groupId) {
      const group = await env.DB.prepare(
        `SELECT g.*,
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count
         FROM groups g
         WHERE g.id = ?
         LIMIT 1`
      )
        .bind(groupId)
        .first();

      if (!group) return bad("Group not found", 404);

      const members = await env.DB.prepare(
        `SELECT gm.user_id, gm.role, gm.created_at,
                u.username, u.name, u.profile_image_url, u.is_verified, u.role as user_role
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY gm.created_at DESC`
      )
        .bind(groupId)
        .all();

      return ok({
        group,
        members: members.results || [],
      });
    }

    // ✅ LIST mode: /api/groups
    const { results } = await env.DB.prepare(
      `SELECT g.*,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count
       FROM groups g
       ORDER BY g.created_at DESC`
    ).all();

    return json(results || []);
  } catch (e: any) {
    return server(e?.message || "Failed to fetch groups");
  }
};
