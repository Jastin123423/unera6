// functions/api/messages/following.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = Number(request.headers.get("x-user-id") || 0);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const result = await env.DB.prepare(`
      SELECT 
        u.id,
        u.name,
        u.profile_image_url,
        COALESCE(p.is_online, 0) as is_online
      FROM user_follows f
      JOIN users u ON u.id = f.following_id
      LEFT JOIN presence p ON p.user_id = u.id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
      LIMIT 30
    `).bind(userId).all();

    return json(result.results || []);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
