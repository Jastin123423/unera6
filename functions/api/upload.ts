import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { R2: R2Bucket };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const PUBLIC_BASE = "https://media.unera.social";

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/** ---------- Helpers ---------- */
const safeExtFromType = (ct: string) => {
  const t = (ct || "").toLowerCase();

  // images
  if (t.includes("jpeg")) return "jpg";
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";

  // video
  if (t.includes("mp4")) return "mp4";
  if (t.includes("webm")) return "webm";
  if (t.includes("quicktime")) return "mov";

  // ✅ audio
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("wav") || t.includes("x-wav")) return "wav";
  if (t.includes("aac")) return "aac";
  if (t.includes("m4a") || t.includes("mp4a") || t.includes("x-m4a")) return "m4a";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("opus")) return "opus";

  return "bin";
};

const pickExtFromFilename = (name: string) => {
  const n = String(name || "").trim();
  if (!n || !n.includes(".")) return "";
  const ext = n.split(".").pop() || "";
  return ext.toLowerCase();
};

const sanitizeFolder = (folder: string) => {
  return String(folder || "uploads")
    .replace(/[^a-z0-9/_-]/gi, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
};

const sanitizeExt = (ext: string) => {
  const e = String(ext || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e || "bin";
};

const safeKey = (folder: string, ext: string) => {
  const f = sanitizeFolder(folder);
  const e = sanitizeExt(ext);
  return `${f}/${Date.now()}-${Math.random().toString(16).slice(2)}.${e}`;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.R2) {
      return Response.json(
        { error: "R2 binding missing (env.R2)" },
        { status: 500, headers: cors }
      );
    }

    const ct = request.headers.get("content-type") || "";

    // ✅ Preferred: multipart/form-data (binary upload)
    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();

      const file = form.get("file");
      if (!(file instanceof File)) {
        return Response.json(
          { error: "file is required (multipart field name: file)" },
          { status: 400, headers: cors }
        );
      }

      // Optional fields from client
      const folder = String(form.get("folder") || "uploads");
      const clientFilename = String(form.get("filename") || (file as any).name || "").trim();

      const contentType = file.type || "application/octet-stream";

      const extFromName = pickExtFromFilename(clientFilename || file.name);
      const extFromType = safeExtFromType(contentType);
      const ext = extFromName || extFromType;

      const key = safeKey(folder, ext);
      const bytes = new Uint8Array(await file.arrayBuffer());

      await env.R2.put(key, bytes, {
        httpMetadata: {
          contentType,
          contentDisposition: "inline",
        },
      });

      const url = `${PUBLIC_BASE}/${key}`;
      return Response.json(
        { success: true, key, url, contentType },
        { status: 200, headers: cors }
      );
    }

    // ✅ Fallback: JSON base64 (works only for small files)
    const body = await request.json().catch(() => ({} as any));

    const folder = String(body.folder || "uploads");
    const filename = String(body.filename || "").trim();
    const contentType = String(body.contentType || "application/octet-stream").trim();
    const dataBase64 = String(body.dataBase64 || "").trim();

    if (!dataBase64) {
      return Response.json(
        { error: "dataBase64 is required" },
        { status: 400, headers: cors }
      );
    }

    const base64 = dataBase64.includes("base64,")
      ? dataBase64.split("base64,")[1]
      : dataBase64;

    // decode base64 safely
    let bin: string;
    try {
      bin = atob(base64);
    } catch {
      return Response.json(
        { error: "Invalid base64 data" },
        { status: 400, headers: cors }
      );
    }

    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const extFromName = pickExtFromFilename(filename);
    const extFromType = safeExtFromType(contentType);
    const ext = extFromName || extFromType;

    const key = safeKey(folder, ext);

    await env.R2.put(key, bytes, {
      httpMetadata: {
        contentType,
        contentDisposition: "inline",
      },
    });

    const url = `${PUBLIC_BASE}/${key}`;
    return Response.json(
      { success: true, key, url, contentType },
      { status: 200, headers: cors }
    );
  } catch (e: any) {
    return Response.json(
      { success: false, error: e?.message || "Upload failed" },
      { status: 500, headers: cors }
    );
  }
};
