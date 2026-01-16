// functions/api/posts.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const safeString = (v: any) => (typeof v === "string" ? v : "");
const safeNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ error: "D1 binding missing. Set Pages D1 binding name to DB." }, 500);

    const body = await request.json().catch(() => ({} as any));

    const user_id = safeNumber(body.user_id, 0);
    if (!user_id) return json({ error: "Login required (user_id missing)." }, 401);

    const content = safeString(body.content).trim();
    const media_url = body.media_url ?? null;
    const media_type = body.media_type ?? null;

    if (!content && !media_url) return json({ error: "content or media_url is required" }, 400);

    // ✅ BLOCK base64 uploads (they destroy feed performance)
    if (typeof media_url === "string" && media_url.startsWith("data:")) {
      return json(
        {
          error: "Media upload not supported in base64.",
          message: "Upload to R2/Cloudflare Images and store a normal https URL in media_url.",
        },
        413
      );
    }

    // Optional: only allow normal URLs if media_url exists
    if (typeof media_url === "string" && media_url.length > 0) {
      try {
        const u = new URL(media_url);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad protocol");
      } catch {
        return json({ error: "media_url must be a valid http/https URL" }, 400);
      }
    }

    const result = await env.DB.prepare(
      `INSERT INTO posts (user_id, content, media_url, media_type)
       VALUES (?, ?, ?, ?)`
    )
      .bind(user_id, content || null, media_url, media_type)
      .run();

    return json({ success: true, post_id: result.meta?.last_row_id }, 201);
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ error: "D1 binding missing. Set Pages D1 binding name to DB." }, 500);

    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 50)));

    const { results } = await env.DB
      .prepare("SELECT * FROM posts ORDER BY created_at DESC LIMIT ?")
      .bind(limit)
      .all();

    return json(Array.isArray(results) ? results : [], 200);
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};
