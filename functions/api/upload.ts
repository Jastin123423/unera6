import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { R2: R2Bucket };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

const PUBLIC_BASE = "https://media.unera.social";
const LONG_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const safeExtFromType = (ct: string) => {
  const t = (ct || "").toLowerCase();

  // images
  if (t.includes("jpeg")) return "jpg";
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  if (t.includes("avif")) return "avif";

  // video
  if (t.includes("mp4")) return "mp4";
  if (t.includes("webm")) return "webm";
  if (t.includes("quicktime")) return "mov";

  // audio
  if (t.includes("opus")) return "webm";
  if (t.includes("audio/webm")) return "webm";
  if (t === "audio/mpeg" || t.includes("mpeg")) return "mp3";
  if (t.includes("wav")) return "wav";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("aac")) return "aac";
  if (t.includes("m4a")) return "m4a";
  if (t.includes("audio/mp4")) return "m4a";

  // docs
  if (t.includes("pdf")) return "pdf";
  if (t.includes("msword")) return "doc";
  if (t.includes("officedocument.wordprocessingml")) return "docx";
  if (t.includes("officedocument.spreadsheetml")) return "xlsx";
  if (t.includes("officedocument.presentationml")) return "pptx";
  if (t.includes("text/plain")) return "txt";

  if (t.includes("zip")) return "zip";

  return "bin";
};

const contentTypeFromExt = (ext: string) => {
  const e = (ext || "").toLowerCase();

  // images
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  if (e === "avif") return "image/avif";

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

  // docs
  if (e === "pdf") return "application/pdf";
  if (e === "txt") return "text/plain; charset=utf-8";
  if (e === "doc") return "application/msword";
  if (e === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (e === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (e === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  if (e === "zip") return "application/zip";

  return "application/octet-stream";
};

const fileTypeFromMimeOrExt = (mime: string, ext: string) => {
  const m = (mime || "").toLowerCase();
  const e = (ext || "").toLowerCase();

  if (m.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "avif"].includes(e)) return "image";
  if (m.includes("gif") || e === "gif") return "gif";
  if (m.startsWith("video/") || ["mp4", "webm", "mov"].includes(e)) return "video";
  if (m.startsWith("audio/") || m.includes("opus") || ["mp3", "wav", "ogg", "aac", "m4a", "webm"].includes(e)) return "audio";

  if (m === "application/pdf" || e === "pdf") return "document";

  if (
    m.includes("officedocument") ||
    m.includes("msword") ||
    ["doc", "docx", "xlsx", "pptx", "txt"].includes(e)
  ) {
    return "document";
  }

  return "other";
};

const safeKey = (ext: string, prefix = "uploads") =>
  `${prefix}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext || "bin"}`;

const safeVariantKey = (base: string, variant: string, ext: string) =>
  `${base}_${variant}.${ext || "bin"}`;

const publicUrl = (key: string) => `${PUBLIC_BASE}/${key}`;

const toJson = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const getFileInfo = async (file: File) => {
  const filename = String(file.name || "").trim();
  const nameExt = filename && filename.includes(".") ? filename.split(".").pop() || "" : "";
  const fallbackExt = safeExtFromType(file.type || "");
  const ext = String(nameExt || fallbackExt || "bin").toLowerCase();

  let mime_type = (file.type || "").trim();
  if (!mime_type || mime_type === "application/octet-stream") {
    mime_type = contentTypeFromExt(ext);
  }

  const file_type = fileTypeFromMimeOrExt(mime_type, ext);
  const bytes = new Uint8Array(await file.arrayBuffer());

  return {
    filename,
    ext,
    mime_type,
    file_type,
    bytes,
  };
};

const putObject = async (
  env: Env,
  {
    key,
    bytes,
    mime_type,
    filename,
    file_type,
  }: {
    key: string;
    bytes: Uint8Array;
    mime_type: string;
    filename: string;
    file_type: string;
  }
) => {
  await env.R2.put(key, bytes, {
    httpMetadata: {
      contentType: mime_type,
      cacheControl: LONG_CACHE_CONTROL,
    },
    customMetadata: {
      filename: filename || "upload",
      mime_type,
      file_type,
    },
  });

  return publicUrl(key);
};

const cfImageTransform = async (
  originalBuffer: Uint8Array,
  opts: {
    width: number;
    fit?: "cover" | "contain" | "scale-down";
    quality?: number;
    format?: "webp" | "avif" | "jpeg" | "png";
  }
) => {
  const res = await fetch("https://dummy", {
    method: "POST",
    body: originalBuffer,
    // @ts-ignore
    cf: {
      image: {
        width: opts.width,
        fit: opts.fit || "cover",
        quality: opts.quality ?? 78,
        format: opts.format || "webp",
      },
    },
  });

  if (!res.ok) {
    throw new Error(`Image transform failed: ${res.status}`);
  }

  return new Uint8Array(await res.arrayBuffer());
};

const processImageVariants = async (
  env: Env,
  file: File,
  baseFolder = "uploads/images"
) => {
  const { filename, bytes, file_type } = await getFileInfo(file);

  const baseKey = `${baseFolder}/${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // Store full/original as uploaded
  const originalInfo = await getFileInfo(file);
  const originalKey = safeVariantKey(baseKey, "full", originalInfo.ext);

  const originalUrl = await putObject(env, {
    key: originalKey,
    bytes: originalInfo.bytes,
    mime_type: originalInfo.mime_type,
    filename: originalInfo.filename || `upload.${originalInfo.ext}`,
    file_type: originalInfo.file_type,
  });

  // Feed variant
  const feedBuffer = await cfImageTransform(bytes, {
    width: 1080,
    fit: "cover",
    quality: 80,
    format: "webp",
  });

  const feedKey = safeVariantKey(baseKey, "feed", "webp");
  const feedUrl = await putObject(env, {
    key: feedKey,
    bytes: feedBuffer,
    mime_type: "image/webp",
    filename: filename || "feed.webp",
    file_type,
  });

  // Thumbnail variant
  const thumbBuffer = await cfImageTransform(bytes, {
    width: 320,
    fit: "cover",
    quality: 70,
    format: "webp",
  });

  const thumbKey = safeVariantKey(baseKey, "thumb", "webp");
  const thumbUrl = await putObject(env, {
    key: thumbKey,
    bytes: thumbBuffer,
    mime_type: "image/webp",
    filename: filename || "thumb.webp",
    file_type,
  });

  return {
    success: true,
    media_type: "image",
    media_urls: {
      thumb: thumbUrl,
      feed: feedUrl,
      full: originalUrl,
    },
    key: originalKey,
    url: originalUrl,
    filename: filename || null,
    size_bytes: originalInfo.bytes.byteLength,
    mime_type: originalInfo.mime_type,
    file_type: originalInfo.file_type,
    metadata: {
      cache_control: LONG_CACHE_CONTROL,
    },
  };
};

const uploadBundlePart = async (
  env: Env,
  file: File,
  baseFolder: string,
  variant: string
) => {
  const info = await getFileInfo(file);
  const key = safeVariantKey(baseFolder, variant, info.ext);
  const url = await putObject(env, {
    key,
    bytes: info.bytes,
    mime_type: info.mime_type,
    filename: info.filename || `${variant}.${info.ext}`,
    file_type: info.file_type,
  });

  return {
    key,
    url,
    filename: info.filename || null,
    size_bytes: info.bytes.byteLength,
    mime_type: info.mime_type,
    file_type: info.file_type,
    cache_control: LONG_CACHE_CONTROL,
  };
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.R2) {
      return toJson({ success: false, error: "R2 binding missing (env.R2)" }, 500);
    }

    const ct = request.headers.get("content-type") || "";

    // =========================
    // MULTIPART FORM DATA
    // =========================
    if (ct.includes("multipart/form-data")) {
      const form = await request.formData();

      const singleFile = form.get("file");

      // bundle fields
      const originalFile = form.get("original");
      const feedFile = form.get("feed");
      const playFile = form.get("play");
      const thumbnailFile = form.get("thumbnail");
      const audioFile = form.get("audio");

      // =========================================
      // MULTI-ASSET BUNDLE UPLOAD
      // =========================================
      if (
        originalFile instanceof File ||
        feedFile instanceof File ||
        playFile instanceof File ||
        thumbnailFile instanceof File ||
        audioFile instanceof File
      ) {
        const baseFolder = `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const uploaded: Record<string, any> = {};

        if (originalFile instanceof File) {
          uploaded.original = await uploadBundlePart(env, originalFile, baseFolder, "original");
        }

        if (feedFile instanceof File) {
          uploaded.feed = await uploadBundlePart(env, feedFile, baseFolder, "feed");
        }

        if (playFile instanceof File) {
          uploaded.play = await uploadBundlePart(env, playFile, baseFolder, "play");
        }

        if (thumbnailFile instanceof File) {
          uploaded.thumbnail = await uploadBundlePart(env, thumbnailFile, baseFolder, "thumbnail");
        }

        if (audioFile instanceof File) {
          uploaded.audio = await uploadBundlePart(env, audioFile, baseFolder, "audio");
        }

        return toJson({
          success: true,
          media_type: "bundle",
          uploaded,
        });
      }

      // =========================================
      // LEGACY SINGLE FILE UPLOAD
      // =========================================
      if (!(singleFile instanceof File)) {
        return toJson(
          {
            success: false,
            error:
              "file is required (multipart field name: file), or send original/feed/play/thumbnail/audio fields",
          },
          400
        );
      }

      const { filename, ext, mime_type, file_type, bytes } = await getFileInfo(singleFile);

      // Image: generate 3 URLs
      if (file_type === "image" || file_type === "gif") {
        const imageResult = await processImageVariants(env, singleFile);
        return toJson({
          ...imageResult,
          media_urls: JSON.stringify(imageResult.media_urls),
        });
      }

      // Video/audio/doc: store original only
      const folder =
        file_type === "video"
          ? "uploads/videos"
          : file_type === "audio"
          ? "uploads/audio"
          : file_type === "document"
          ? "uploads/documents"
          : "uploads/files";

      const key = safeKey(ext, folder);
      const url = await putObject(env, {
        key,
        bytes,
        mime_type,
        filename: filename || `upload.${ext}`,
        file_type,
      });

      return toJson({
        success: true,
        key,
        url,
        filename: filename || null,
        size_bytes: bytes.byteLength,
        mime_type,
        file_type,
        metadata: {
          cache_control: LONG_CACHE_CONTROL,
        },
      });
    }

    // =========================
    // JSON BASE64 FALLBACK
    // =========================
    const body = await request.json().catch(() => ({} as any));
    const filename = String(body.filename || "").trim();
    const incomingType = String(body.contentType || body.mime_type || "").trim();
    const dataBase64 = String(body.dataBase64 || "").trim();

    if (!dataBase64) {
      return toJson({ success: false, error: "dataBase64 is required" }, 400);
    }

    const base64 = dataBase64.includes("base64,")
      ? dataBase64.split("base64,")[1]
      : dataBase64;

    let bin: string;
    try {
      bin = atob(base64);
    } catch {
      return toJson({ success: false, error: "Invalid base64 data" }, 400);
    }

    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const nameExt = filename && filename.includes(".") ? filename.split(".").pop() || "" : "";
    const fallbackExt = safeExtFromType(incomingType);
    const ext = String(nameExt || fallbackExt || "bin").toLowerCase();

    let mime_type = incomingType;
    if (!mime_type || mime_type === "application/octet-stream") {
      mime_type = contentTypeFromExt(ext);
    }

    const file_type = fileTypeFromMimeOrExt(mime_type, ext);

    if (file_type === "image" || file_type === "gif") {
      const originalFile = new File([bytes], filename || `upload.${ext}`, { type: mime_type });
      const imageResult = await processImageVariants(env, originalFile);

      return toJson({
        ...imageResult,
        media_urls: JSON.stringify(imageResult.media_urls),
      });
    }

    const folder =
      file_type === "video"
        ? "uploads/videos"
        : file_type === "audio"
        ? "uploads/audio"
        : file_type === "document"
        ? "uploads/documents"
        : "uploads/files";

    const key = safeKey(ext, folder);
    const url = await putObject(env, {
      key,
      bytes,
      mime_type,
      filename: filename || `upload.${ext}`,
      file_type,
    });

    return toJson({
      success: true,
      key,
      url,
      filename: filename || null,
      size_bytes: bytes.byteLength,
      mime_type,
      file_type,
      metadata: {
        cache_control: LONG_CACHE_CONTROL,
      },
    });
  } catch (e: any) {
    return toJson({ success: false, error: e?.message || "Upload failed" }, 500);
  }
};
