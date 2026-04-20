// functions/api/groups.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server, json } from "./_cors";

const safeString = (v: any) => (typeof v === "string" ? v : String(v ?? ""));
const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeCategory = (v: any) => {
  const key = safeString(v).trim().toLowerCase();
  const allowed = new Set(["general", "recruitment", "buy_sell", "music_drama"]);
  return allowed.has(key) ? key : "general";
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));

    const admin_id = toNum(body.admin_id, 0);
    const name = safeString(body.name).trim();
    const description = safeString(body.description).trim();
    const type = safeString(body.type || "public").trim().toLowerCase();
    const cover_image = body.cover_image ? safeString(body.cover_image).trim() : null;
    const profile_image = body.profile_image ? safeString(body.profile_image).trim() : null;
    const category = normalizeCategory(body.category);

    if (!admin_id) return bad("admin_id is required");
    if (!name) return bad("name is required");
    if (!description) return bad("description is required");
    if (!(type === "public" || type === "private")) {
      return bad("type must be public or private");
    }

    const result = await env.DB.prepare(
      `INSERT INTO groups (admin_id, name, description, type, cover_image, profile_image, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(admin_id, name, description, type, cover_image, profile_image, category)
      .run();

    const group_id = Number(result.meta.last_row_id);

    // auto-add admin as member
    await env.DB.prepare(
      `INSERT OR IGNORE INTO group_members (group_id, user_id, role)
       VALUES (?, ?, 'admin')`
    )
      .bind(group_id, admin_id)
      .run();

    // keep groups.members_count in sync
    await env.DB.prepare(
      `UPDATE groups
       SET members_count = (
         SELECT COUNT(*)
         FROM group_members gm
         WHERE gm.group_id = ?
       )
       WHERE id = ?`
    )
      .bind(group_id, group_id)
      .run();

    const created = await env.DB.prepare(
      `SELECT g.*,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
              1 AS is_member
       FROM groups g
       WHERE g.id = ?
       LIMIT 1`
    )
      .bind(group_id)
      .first();

    if (created) {
      (created as any).category = normalizeCategory((created as any).category);
    }

    return ok({
      success: true,
      group_id,
      group: created || null,
    });
  } catch (e: any) {
    return server(e?.message || "Failed to create group");
  }
};

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const groupId = toNum(url.searchParams.get("id"), 0);

    const viewerId =
      toNum(url.searchParams.get("viewerId"), 0) ||
      toNum(request.headers.get("x-user-id"), 0);

    // DETAILS mode: /api/groups?id=123&viewerId=7
    if (groupId) {
      const group = await env.DB.prepare(
        `SELECT
           g.*,
           (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
           CASE
             WHEN g.admin_id = ? THEN 1
             WHEN EXISTS (
               SELECT 1
               FROM group_members gm2
               WHERE gm2.group_id = g.id
                 AND gm2.user_id = ?
             ) THEN 1
             ELSE 0
           END AS is_member
         FROM groups g
         WHERE g.id = ?
         LIMIT 1`
      )
        .bind(viewerId, viewerId, groupId)
        .first();

      if (!group) return bad("Group not found", 404);

      (group as any).category = normalizeCategory((group as any).category);

      const members = await env.DB.prepare(
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
        .bind(groupId)
        .all();

      return ok({
        success: true,
        group,
        members: members.results || [],
      });
    }

    // LIST mode: /api/groups?viewerId=7
    const { results } = await env.DB.prepare(
      `SELECT
         g.*,
         (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
         CASE
           WHEN g.admin_id = ? THEN 1
           WHEN EXISTS (
             SELECT 1
             FROM group_members gm2
             WHERE gm2.group_id = g.id
               AND gm2.user_id = ?
           ) THEN 1
           ELSE 0
         END AS is_member
       FROM groups g
       ORDER BY datetime(g.created_at) DESC`
    )
      .bind(viewerId, viewerId)
      .all();

    const fixed = (results || []).map((g: any) => ({
      ...g,
      category: normalizeCategory(g.category),
    }));

    return json(fixed);
  } catch (e: any) {
    return server(e?.message || "Failed to fetch groups");
  }
};
