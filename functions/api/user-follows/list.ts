import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const userId = Number(url.searchParams.get("userId") || 0);
    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400, headers: cors });
    }

    // followers: people who follow userId
    const followersRes = await env.DB.prepare(
      `SELECT follower_id FROM user_follows WHERE following_id = ?`
    ).bind(userId).all();

    // following: people userId follows
    const followingRes = await env.DB.prepare(
      `SELECT following_id FROM user_follows WHERE follower_id = ?`
    ).bind(userId).all();

    const followers = (followersRes.results || []).map((r: any) => Number(r.follower_id)).filter(Boolean);
    const following = (followingRes.results || []).map((r: any) => Number(r.following_id)).filter(Boolean);

    return Response.json({ success: true, userId, followers, following }, { status: 200, headers: cors });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500, headers: cors });
  }
};
