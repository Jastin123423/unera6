import type { PagesFunction } from "@cloudflare/workers-types";

type Env = {
  R2: R2Bucket;
  DB: D1Database;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);

const guessExt = (contentType: string) => {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("jpeg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("mp4")) return "mp4";
  if (ct.includes("webm")) return "webm";
  if (ct.includes("quicktime")) return "mov";
  return "bin";
};

// ✅ change to your R2 custom domain when you finish it
// Example after you add custom domain: https://media.unera.social
const PUBLIC_BASE = "https://media.unera.social"; // <-- REPLACE THIS

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.R2) return json({ error: "R2 binding missing (R2)" }, 500);

    // ✅ UNERA rule: guests can read only, cannot upload
    // Simple check: require user_id and confirm it exists in DB
    const url = new URL(request.url);
    const userId = Number(url.searchParams.get("userId") || 0);
    if (!userId) return json({ error: "Login required (missing userId)" }, 401);

    if (env.DB) {
      const u = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
      if (!u) return json({ error: "Invalid user" }, 401);
    }

    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return json({ error: 'Use multipart/form-data with field name "file"' }, 400);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: 'Missing file field "file"' }, 400);

    // Limits (tune as you want)
    const isVideo = (file.type || "").startsWith("video/");
    const maxBytes = isVideo ? 80 * 1024 * 1024 : 12 * 1024 * 1024; // 80MB video, 12MB image
    if (file.size > maxBytes) return json({ error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)` }, 413);

    const contentType = file.type || "application/octet-stream";
    const ext = guessExt(contentType);
    const folder = isVideo ? "videos" : (contentType.startsWith("image/") ? "images" : "files");

    const original = safeName(file.name || `upload.${ext}`);
    const key = `${folder}/${userId}/${Date.now()}-${crypto.randomUUID()}-${original}`;

    await env.R2.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: { originalName: original, userId: String(userId) },
    });

    const urlOut = `${PUBLIC_BASE}/${key}`;
    return json({ success: true, key, url: urlOut, contentType, size: file.size });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
