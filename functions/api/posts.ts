import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  // ✅ Guard: DB binding must exist
  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: "D1 binding DB is missing in Pages settings." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  // ✅ Guard: JSON parsing can fail
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { user_id, content, media_url, media_type } = body;

  // ✅ Basic validation
  if (!user_id || !content) {
    return new Response(JSON.stringify({ error: "user_id and content are required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const result = await env.DB
    .prepare(
      `INSERT INTO posts (user_id, content, media_url, media_type)
       VALUES (?, ?, ?, ?)`
    )
    .bind(user_id, content, media_url ?? null, media_type ?? null)
    .run();

  return new Response(
    JSON.stringify({ success: true, post_id: result.meta.last_row_id }),
    { headers: { "content-type": "application/json" } }
  );
};

export const onRequestGet: PagesFunction = async ({ env }) => {
  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: "D1 binding DB is missing in Pages settings." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const { results } = await env.DB
    .prepare("SELECT * FROM posts ORDER BY created_at DESC")
    .all();

  return new Response(JSON.stringify(results), {
    headers: { "content-type": "application/json" },
  });
};
