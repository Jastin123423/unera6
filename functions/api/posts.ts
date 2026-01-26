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

const isHttpUrl = (v: any) => {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeStringArray = (v: any): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof v === "string") {
    // allow JSON string
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x || "").trim()).filter(Boolean);
    } catch {}
  }
  return [];
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

    // single media (backward compatible)
    const media_url = body.media_url ?? null;
    const media_type = body.media_type ?? null;

    // multi media (new)
    const media_urls_arr = normalizeStringArray(body.media_urls);
    const media_types_arr = normalizeStringArray(body.media_types);

    // Validate and filter multi URLs
    const filtered_urls = media_urls_arr
      .filter((u) => !u.startsWith("data:"))
      .filter((u) => isHttpUrl(u));

    // Keep types aligned (best-effort)
    const filtered_types: string[] = [];
    for (let i = 0; i < filtered_urls.length; i++) {
      const t = String(media_types_arr[i] || "").trim();
      filtered_types.push(t || "");
    }

    // If multi provided but single missing, set single = first (compat)
    const final_media_url =
      typeof media_url === "string" && media_url.trim().length > 0
        ? media_url
        : (filtered_urls[0] ?? null);

    const final_media_type =
      typeof media_type === "string" && media_type.trim().length > 0
        ? media_type
        : (filtered_types[0] ?? null);

    // ✅ Required: content OR any media
    const hasSingle = typeof final_media_url === "string" && final_media_url.trim().length > 0;
    const hasMulti = filtered_urls.length > 0;

    if (!content && !hasSingle && !hasMulti) {
      return json({ error: "content or media_url or media_urls is required" }, 400);
    }

    // ✅ BLOCK base64 uploads
    if (typeof final_media_url === "string" && final_media_url.startsWith("data:")) {
      return json(
        {
          error: "Media upload not supported in base64.",
          message: "Upload to R2/Cloudflare Images and store a normal https URL in media_url/media_urls.",
        },
        413
      );
    }

    // Optional: only allow normal URLs if media_url exists
    if (typeof final_media_url === "string" && final_media_url.length > 0) {
      if (!isHttpUrl(final_media_url)) {
        return json({ error: "media_url must be a valid http/https URL" }, 400);
      }
    }

    // store arrays as JSON text in D1
    const media_urls_json = filtered_urls.length ? JSON.stringify(filtered_urls) : null;
    const media_types_json = filtered_urls.length ? JSON.stringify(filtered_types) : null;

    // ✅ Insert includes multi fields (requires columns exist in D1)
    const result = await env.DB.prepare(
      `INSERT INTO posts (user_id, content, media_url, media_type, media_urls, media_types)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        user_id,
        content || null,
        final_media_url,
        final_media_type,
        media_urls_json,
        media_types_json
      )
      .run();

    const post_id = result.meta?.last_row_id;

    // Return a post object (helps UI show immediately)
    return json(
      {
        success: true,
        post_id,
        post: {
          id: post_id,
          user_id,
          content: content || "",
          media_url: final_media_url,
          media_type: final_media_type,
          media_urls: media_urls_json,   // returned as JSON string (App normalizer supports it)
          media_types: media_types_json, // returned as JSON string
          visibility: body.visibility ?? "public",
          created_at: new Date().toISOString(),
          views: 0,
          shares: 0,
        },
      },
      201
    );
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
