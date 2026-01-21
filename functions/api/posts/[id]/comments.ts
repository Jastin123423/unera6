import type { PagesFunction } from "@cloudflare/workers-types";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestGet: PagesFunction = async ({ env, params, request }) => {
  try {
    const postIdRaw = (params as any)?.id;
    const postId = Number(postIdRaw);

    if (!Number.isFinite(postId) || postId <= 0) {
      return Response.json({ error: "Invalid post id" }, { status: 400, headers: cors });
    }

    // ✅ viewerId is optional (0 = guest)
    const url = new URL(request.url);
    const viewerId = toInt(url.searchParams.get("viewerId"), 0);

    // ✅ IMPORTANT: requires comment_reactions table (from previous step)
    const q = `
      SELECT
        pc.id,
        pc.post_id,
        pc.user_id,
        pc.text,
        pc.created_at,

        COALESCE(u.username, '
