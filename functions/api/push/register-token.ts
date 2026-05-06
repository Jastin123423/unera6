import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({}));

    const user_id = Number(body.user_id || 0);
    const token = String(body.token || "").trim();
    const platform = String(body.platform || "android").trim();

    if (!user_id) return json({ success: false, error: "user_id required" }, 400);
    if (!token) return json({ success: false, error: "token required" }, 400);

    await env.DB.prepare(`
      INSERT INTO push_tokens (user_id, token, platform, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(token) DO UPDATE SET
        user_id = excluded.user_id,
        platform = excluded.platform,
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(user_id, token, platform).run();

    return json({ success: true });
  } catch (err: any) {
    return json({ success: false, error: String(err?.message || err) }, 500);
  }
};
