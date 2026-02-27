// functions/api/groups.ts
import type { PagesFunction } from "@cloudflare/workers-types";
import { cors, ok, bad, server, json } from "./_cors";

type GroupCategoryKey = "general" | "recruitment" | "buy_sell" | "music_drama";

const GROUP_CATEGORIES: Array<{
  id: GroupCategoryKey;
  title: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
}> = [
  {
    id: "general",
    title: "General",
    description: "Community discussions and updates",
    icon: "fas fa-users",
    color: "#1877F2",
    features: ["Announcements", "Discussions", "Community posts"],
  },
  {
    id: "recruitment",
    title: "Recruitment",
    description: "Find talent, job opportunities, and professional networking",
    icon: "fas fa-briefcase",
    color: "#45BD62",
    features: ["Job postings", "Talent search", "Professional networking"],
  },
  {
    id: "buy_sell",
    title: "Buy and Sell",
    description: "Marketplace for buying, selling, and trading items",
    icon: "fas fa-store",
    color: "#F7B928",
    features: ["Item listings", "Price tags", "Location filtering", "Sold/Pending status"],
  },
  {
    id: "music_drama",
    title: "Music & Drama",
    description: "Share music, videos, movie series, and performances",
    icon: "fas fa-music",
    color: "#F3425F",
    features: ["Video player", "Music playback", "Series episodes", "Performance showcase"],
  },
];

const CATEGORY_KEYS = new Set(GROUP_CATEGORIES.map((c) => c.id));

const safeString = (v: any) => (typeof v === "string" ? v : "");
const normalizeCategory = (raw: any): GroupCategoryKey => {
  const key = safeString(raw).trim().toLowerCase() as GroupCategoryKey;
  return CATEGORY_KEYS.has(key) ? key : "general";
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    if (!env.DB) return server("DB binding missing (DB)");

    const body = await request.json().catch(() => ({} as any));

    const admin_id = Number(body.admin_id || 0);
    const name = safeString(body.name).trim();
    const description = safeString(body.description).trim();
    const type = safeString(body.type || "public").trim().toLowerCase();
    const cover_image = body.cover_image ? safeString(body.cover_image).trim() : null;
    const profile_image = body.profile_image ? safeString(body.profile_image).trim() : null;

    // ✅ category support (defaults to "general")
    const category = normalizeCategory(body.category);

    if (!admin_id) return bad("admin_id is required");
    if (!name) return bad("name is required");
    if (!description) return bad("description is required");
    if (!(type === "public" || type === "private")) return bad("type must be public or private");

    const result = await env.DB.prepare(
      `INSERT INTO groups (admin_id, name, description, type, cover_image, profile_image, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(admin_id, name, description, type, cover_image, profile_image, category)
      .run();

    const group_id = Number(result.meta.last_row_id);

    // ✅ auto-add admin as member (idempotent)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')`
    )
      .bind(group_id, admin_id)
      .run();

    return ok({ group_id, category });
  } catch (e: any) {
    return server(e?.message || "Failed to create group");
  }
};

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  try {
    if (!env.DB) return server("DB binding missing (DB)");

    const url = new URL(request.url);
    const groupId = Number(url.searchParams.get("id") || 0);
    const includeCategories = url.searchParams.get("include_categories") === "1";

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
        `SELECT gm.user_id, gm.role, gm.joined_at,
                u.username, u.name, u.profile_image_url, u.is_verified, u.role as user_role
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY gm.joined_at DESC`
      )
        .bind(groupId)
        .all();

      // Ensure category always exists (in case old rows existed before migration)
      const safeGroup = {
        ...group,
        category: CATEGORY_KEYS.has((group as any).category) ? (group as any).category : "general",
      };

      return ok({
        group: safeGroup,
        members: members.results || [],
        ...(includeCategories ? { categories: GROUP_CATEGORIES } : {}),
      });
    }

    // ✅ LIST mode: /api/groups
    const { results } = await env.DB.prepare(
      `SELECT g.*,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count
       FROM groups g
       ORDER BY g.created_at DESC`
    ).all();

    const groups = (results || []).map((g: any) => ({
      ...g,
      category: CATEGORY_KEYS.has(g.category) ? g.category : "general",
    }));

    // Keep old response shape by default (array), but allow returning categories when requested
    if (includeCategories) return ok({ groups, categories: GROUP_CATEGORIES });

    return json(groups);
  } catch (e: any) {
    return server(e?.message || "Failed to fetch groups");
  }
};
