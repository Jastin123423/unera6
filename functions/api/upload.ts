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

  // audio
  if (t.includes("mpeg")) return "mp3"; // audio/mpeg
  if (t.includes("mp3")) return "mp3";
  if (t.includes("wav")) return "wav";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("aac")) return "aac";
  if (t.includes("m4a")) return "m4a";
  if (t.includes("mp4")) return "m4a"; // audio/mp4 sometimes

  return "bin";
};

const contentTypeFromExt = (ext: string) => {
  const e = (ext || "").toLowerCase();

  // images
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";

  // video
  if (e === "mp4") return "video/mp4";
  if (e === "webm") return "video/webm";
  if (e === "mov") return "video/quicktime";

  // audio
  if (e === "mp3") return "audio/mpeg";
  if (e === "wav") return "audio/wav";
  if (e === "ogg") return "audio/ogg";
  if (e === "aac") return "audio/aac";
  if (e === "m4a") return "audio/mp4";

  return "application/octet-stream";
};

const safeKey = (ext: string) =>
  `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext || "bin"}`;

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

      // Determine ext
      const nameExt =
        file.name && file.name.includes(".")
          ? file.name.split(".").pop() || ""
          : "";
      const fallbackExt = safeExtFromType(file.type || "");
      const ext = String(nameExt || fallbackExt || "bin").toLowerCase();

      // Determine content type (IMPORTANT for audio playback)
      let contentType = (file.type || "").trim();
      if (!contentType || contentType === "application/octet-stream") {
        contentType = contentTypeFromExt(ext);
      }

      const key = safeKey(ext);
      const bytes = new Uint8Array(await file.arrayBuffer());

      await env.R2.put(key, bytes, {
        httpMetadata: { contentType },
      });

      const url = `${PUBLIC_BASE}/${key}`;
      return Response.json(
        { success: true, key, url, contentType },
        { status: 200, headers: cors }
      );
    }

    // ✅ Fallback: JSON base64 (works only for small files)
    const body = await request.json().catch(() => ({} as any));
    const filename = String(body.filename || "").trim();
    const incomingType = String(body.contentType || "").trim();
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

    const nameExt =
      filename && filename.includes(".") ? filename.split(".").pop() || "" : "";
    const fallbackExt = safeExtFromType(incomingType);
    const ext = String(nameExt || fallbackExt || "bin").toLowerCase();

    let contentType = incomingType;
    if (!contentType || contentType === "application/octet-stream") {
      contentType = contentTypeFromExt(ext);
    }

    const key = safeKey(ext);

    await env.R2.put(key, bytes, {
      httpMetadata: { contentType },
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
