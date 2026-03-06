// functions/api/users/suggestions.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const safeNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const userId = safeNumber(url.searchParams.get("user_id"));
    const limit = Math.min(20, Math.max(1, safeNumber(url.searchParams.get("limit"), 8)));

    if (!userId) {
      return json({ error: "user_id is required" }, 400);
    }

    const myFollowingRes = await env.DB.prepare(`
      SELECT following_id
      FROM user_follows
      WHERE follower_id = ?
    `).bind(userId).all();

    const myFollowing = Array.isArray(myFollowingRes.results)
      ? myFollowingRes.results.map((r: any) => Number(r.following_id)).filter(Number.isFinite)
      : [];

    const excludedIds = [userId, ...myFollowing];
    const placeholders = excludedIds.map(() => "?").join(",");

    const query = `
      SELECT
        u.id,
        u.username,
        u.name,
        u.profile_image_url,
        u.is_verified,
        u.role
      FROM users u
      WHERE u.id NOT IN (${placeholders})
      ORDER BY u.id DESC
      LIMIT ?
    `;

    const stmt = env.DB.prepare(query).bind(...excludedIds, limit);
    const res = await stmt.all();

    const suggestions = (res.results || []).map((u: any) => ({
      id: Number(u.id),
      username: u.username || "user",
      name: u.name || u.username || "User",
      profile_image_url: u.profile_image_url || "",
      is_verified: !!u.is_verified,
      role: u.role || "user",
      mutual_count: 0,
      is_following: false,
      score: 0,
    }));

    return json({ suggestions });
  } catch (error: any) {
    return json({ error: error?.message || "Failed to fetch suggestions" }, 500);
  }
};
