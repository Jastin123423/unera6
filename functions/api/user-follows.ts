import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({} as any));
    const follower_id = Number(body.follower_id);
    const following_id = Number(body.following_id);

    if (!follower_id || !following_id) {
      return Response.json(
        { error: "follower_id and following_id are required" },
        { status: 400, headers: cors }
      );
    }

    if (follower_id === following_id) {
      return Response.json(
        { error: "You cannot follow yourself" },
        { status: 400, headers: cors }
      );
    }

    // ✅ UNERA RULE:
    // A follows B => store A->B and B->A
    await env.DB.prepare(
      `
      INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?);
      INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES (?, ?);
      `
    )
      .bind(follower_id, following_id, following_id, follower_id)
      .run();

    return Response.json({ success: true }, { status: 201, headers: cors });
  } catch (e: any) {
    if (String(e?.message || "").includes("FOREIGN KEY")) {
      return Response.json(
        { error: "Invalid follower_id or following_id" },
        { status: 400, headers: cors }
      );
    }
    return Response.json({ error: e?.message || "Server error" }, { status: 500, headers: cors });
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const follower_id = Number(url.searchParams.get("follower_id"));
    const following_id = Number(url.searchParams.get("following_id"));

    if (!follower_id || !following_id) {
      return Response.json(
        { error: "follower_id and following_id are required" },
        { status: 400, headers: cors }
      );
    }

    if (follower_id === following_id) {
      return Response.json(
        { error: "You cannot unfollow yourself" },
        { status: 400, headers: cors }
      );
    }

    // ✅ UNERA RULE:
    // Unfollow removes BOTH directions
    const result = await env.DB.prepare(
      `
      DELETE FROM user_follows
      WHERE (follower_id = ? AND following_id = ?)
         OR (follower_id = ? AND following_id = ?)
      `
    )
      .bind(follower_id, following_id, following_id, follower_id)
      .run();

    if ((result.meta?.changes ?? 0) === 0) {
      return Response.json({ error: "Not following" }, { status: 404, headers: cors });
    }

    return Response.json({ success: true }, { status: 200, headers: cors });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500, headers: cors });
  }
};
