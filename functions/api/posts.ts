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

const safeArrayStrings = (v: any): string[] => {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    // allow JSON string arrays from clients
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
  }
  return [];
};

const isValidHttpUrl = (value: any) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
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

    // Backward compatible single fields
    const singleUrl = body.media_url ?? null;
    const singleType = body.media_type ?? null;

    // New multi fields (array or JSON-string array)
    let media_urls = safeArrayStrings(body.media_urls);
    let media_types = safeArrayStrings(body.media_types);

    // If client only sent single, convert to multi
    if (!media_urls.length && typeof singleUrl === "string" && singleUrl.trim()) {
      media_urls = [singleUrl.trim()];
    }
    if (!media_types.length && typeof singleType === "string" && singleType.trim()) {
      media_types = [singleType.trim()];
    }

    // If multi exists, keep single as first item for older UI/queries
    const media_url = media_urls.length ? media_urls[0] : (singleUrl ?? null);
    const media_type = media_types.length ? media_types[0] : (singleType ?? null);

    // Validate: must have content or at least one media url
    if (!content && !media_url) {
      return json({ error: "content or media_url/media_urls is required" }, 400);
    }

    // Block base64 anywhere
    const allUrls = media_urls.length ? media_urls : (media_url ? [String(media_url)] : []);
    if (allUrls.some((u) => typeof u === "string" && u.startsWith("data:"))) {
      return json(
        {
          error: "Media upload not supported in base64.",
          message: "Upload to R2/Cloudflare Images and store normal https URLs.",
        },
        413
      );
    }

    // Validate URLs
    for (const u of allUrls) {
      if (!isValidHttpUrl(u)) {
        return json({ error: "All media URLs must be valid http/https URLs" }, 400);
      }
    }

    // Keep arrays aligned (if types missing, pad with nulls)
    if (media_urls.length && media_types.length && media_types.length !== media_urls.length) {
      // Don’t reject; just align safely
      const fixed: string[] = [];
      for (let i = 0; i < media_urls.length; i++) {
        fixed.push(media_types[i] ? String(media_types[i]) : "");
      }
      media_types = fixed;
    }

    const media_urls_json = media_urls.length ? JSON.stringify(media_urls) : null;
    const media_types_json = media_types.length ? JSON.stringify(media_types) : null;

    const result = await env.DB.prepare(
      `INSERT INTO posts (user_id, content, media_url, media_type, media_urls, media_types)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        user_id,
        content || null,
        media_url,
        media_type,
        media_urls_json,
        media_types_json
      )
      .run();

    const post_id = result.meta?.last_row_id;

    // Return the created post row (helps App.tsx show multi immediately)
    const created = await env.DB
      .prepare(`SELECT * FROM posts WHERE id = ?`)
      .bind(post_id)
      .first();

    return json({ success: true, post_id, post: created }, 201);
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
      .prepare(
        `SELECT id, user_id, content, media_url, media_type, media_urls, media_types, created_at
         FROM posts
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(limit)
      .all();

    return json(Array.isArray(results) ? results : [], 200);
  } catch (err: any) {
    return json({ error: "Backend crash", message: String(err?.message ?? err) }, 500);
  }
};
