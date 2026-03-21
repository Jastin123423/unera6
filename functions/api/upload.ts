import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { R2: R2Bucket };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
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
  if (e === "webm") return "audio/webm";

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

  if (m.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(e)) return "image";
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

const toJson = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
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

const uploadSingleBlob = async (
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
    httpMetadata: { contentType: mime_type },
    customMetadata: {
      filename: filename || "upload",
      mime_type,
      file_type,
    },
  });

  return `${PUBLIC_BASE}/${key}`;
};

const processImageVariants = async (
  env: Env,
  file: File,
  baseFolder = "uploads"
) => {
  const { filename, ext, mime_type, file_type, bytes } = await getFileInfo(file);
  const baseKey = `${baseFolder}/${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const originalBuffer = bytes;

  const feedRes = await fetch("https://dummy", {
    method: "POST",
    body: originalBuffer,
    // @ts-ignore
    cf: {
      image: {
        width: 1080,
        fit: "cover",
        quality: 78,
      },
    },
  });

  const feedBuffer = new Uint8Array(await feedRes.arrayBuffer());

  const thumbRes = await fetch("https://dummy", {
    method: "POST",
    body: originalBuffer,
    // @ts-ignore
    cf: {
      image: {
        width: 320,
        fit: "cover",
        quality: 68,
      },
    },
  });

  const thumbBuffer = new Uint8Array(await thumbRes.arrayBuffer());

  const originalKey = safeVariantKey(baseKey, "full", ext);
  const feedKey = safeVariantKey(baseKey, "feed", ext);
  const thumbKey = safeVariantKey(baseKey, "thumb", ext);

  await env.R2.put(originalKey, originalBuffer, {
    httpMetadata: { contentType: mime_type },
    customMetadata: {
      filename: filename || `upload.${ext}`,
      mime_type,
      file_type,
    },
  });

  await env.R2.put(feedKey, feedBuffer, {
    httpMetadata: { contentType: mime_type },
    customMetadata: {
      filename: filename || `upload.${ext}`,
      mime_type,
      file_type,
    },
  });

  await env.R2.put(thumbKey, thumbBuffer, {
    httpMetadata: { contentType: mime_type },
    customMetadata: {
      filename: filename || `upload.${ext}`,
      mime_type,
      file_type,
    },
  });

  return {
    success: true,
    media_type: "image",
    media_urls: {
      thumb: `${PUBLIC_BASE}/${thumbKey}`,
      feed: `${PUBLIC_BASE}/${feedKey}`,
      full: `${PUBLIC_BASE}/${originalKey}`,
    },
    key: originalKey,
    url: `${PUBLIC_BASE}/${originalKey}`,
    filename: filename || null,
    size_bytes: bytes.byteLength,
    mime_type,
    file_type,
    metadata: {},
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

      const feedFile = form.get("feed");
      const playFile = form.get("play");
      const thumbnailFile = form.get("thumbnail");
      const audioFile = form.get("audio");

      // =========================================
      // PROFESSIONAL MULTI-ASSET VIDEO UPLOAD
      // =========================================
      if (
        feedFile instanceof File ||
        playFile instanceof File ||
        thumbnailFile instanceof File ||
        audioFile instanceof File
      ) {
        const baseFolder = `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const uploaded: Record<string, any> = {};

        if (feedFile instanceof File) {
          const info = await getFileInfo(feedFile);
          const key = safeVariantKey(baseFolder, "feed", info.ext);
          const url = await uploadSingleBlob(env, {
            key,
            bytes: info.bytes,
            mime_type: info.mime_type,
            filename: info.filename || `feed.${info.ext}`,
            file_type: info.file_type,
          });

          uploaded.feed = {
            key,
            url,
            filename: info.filename || null,
            size_bytes: info.bytes.byteLength,
            mime_type: info.mime_type,
            file_type: info.file_type,
          };
        }

        if (playFile instanceof File) {
          const info = await getFileInfo(playFile);
          const key = safeVariantKey(baseFolder, "play", info.ext);
          const url = await uploadSingleBlob(env, {
            key,
            bytes: info.bytes,
            mime_type: info.mime_type,
            filename: info.filename || `play.${info.ext}`,
            file_type: info.file_type,
          });

          uploaded.play = {
            key,
            url,
            filename: info.filename || null,
            size_bytes: info.bytes.byteLength,
            mime_type: info.mime_type,
            file_type: info.file_type,
          };
        }

        if (thumbnailFile instanceof File) {
          const info = await getFileInfo(thumbnailFile);
          const key = safeVariantKey(baseFolder, "thumbnail", info.ext);
          const url = await uploadSingleBlob(env, {
            key,
            bytes: info.bytes,
            mime_type: info.mime_type,
            filename: info.filename || `thumbnail.${info.ext}`,
            file_type: info.file_type,
          });

          uploaded.thumbnail = {
            key,
            url,
            filename: info.filename || null,
            size_bytes: info.bytes.byteLength,
            mime_type: info.mime_type,
            file_type: info.file_type,
          };
        }

        if (audioFile instanceof File) {
          const info = await getFileInfo(audioFile);
          const key = safeVariantKey(baseFolder, "audio", info.ext);
          const url = await uploadSingleBlob(env, {
            key,
            bytes: info.bytes,
            mime_type: info.mime_type,
            filename: info.filename || `audio.${info.ext}`,
            file_type: info.file_type,
          });

          uploaded.audio = {
            key,
            url,
            filename: info.filename || null,
            size_bytes: info.bytes.byteLength,
            mime_type: info.mime_type,
            file_type: info.file_type,
          };
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
            error: "file is required (multipart field name: file), or send feed/play/thumbnail fields",
          },
          400
        );
      }

      const { filename, ext, mime_type, file_type, bytes } = await getFileInfo(singleFile);

      if (file_type === "image" || file_type === "gif") {
        const imageResult = await processImageVariants(env, singleFile);
        return toJson({
          ...imageResult,
          media_urls: JSON.stringify(imageResult.media_urls),
        });
      }

      const key = safeKey(ext);
      await env.R2.put(key, bytes, {
        httpMetadata: { contentType: mime_type },
        customMetadata: {
          filename: filename || `upload.${ext}`,
          mime_type,
          file_type,
        },
      });

      const url = `${PUBLIC_BASE}/${key}`;

      return toJson({
        success: true,
        key,
        url,
        filename: filename || null,
        size_bytes: bytes.byteLength,
        mime_type,
        file_type,
        metadata: {},
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

    const base64 = dataBase64.includes("base64,") ? dataBase64.split("base64,")[1] : dataBase64;

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
      const baseKey = `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const originalBuffer = bytes;

      const feedRes = await fetch("https://dummy", {
        method: "POST",
        body: originalBuffer,
        // @ts-ignore
        cf: {
          image: {
            width: 1080,
            fit: "cover",
            quality: 78,
          },
        },
      });

      const feedBuffer = new Uint8Array(await feedRes.arrayBuffer());

      const thumbRes = await fetch("https://dummy", {
        method: "POST",
        body: originalBuffer,
        // @ts-ignore
        cf: {
          image: {
            width: 320,
            fit: "cover",
            quality: 68,
          },
        },
      });

      const thumbBuffer = new Uint8Array(await thumbRes.arrayBuffer());

      const originalKey = `${baseKey}_full.${ext}`;
      const feedKey = `${baseKey}_feed.${ext}`;
      const thumbKey = `${baseKey}_thumb.${ext}`;

      await env.R2.put(originalKey, originalBuffer, {
        httpMetadata: { contentType: mime_type },
        customMetadata: {
          filename: filename || `upload.${ext}`,
          mime_type,
          file_type,
        },
      });

      await env.R2.put(feedKey, feedBuffer, {
        httpMetadata: { contentType: mime_type },
        customMetadata: {
          filename: filename || `upload.${ext}`,
          mime_type,
          file_type,
        },
      });

      await env.R2.put(thumbKey, thumbBuffer, {
        httpMetadata: { contentType: mime_type },
        customMetadata: {
          filename: filename || `upload.${ext}`,
          mime_type,
          file_type,
        },
      });

      return toJson({
        success: true,
        media_type: "image",
        media_urls: JSON.stringify({
          thumb: `${PUBLIC_BASE}/${thumbKey}`,
          feed: `${PUBLIC_BASE}/${feedKey}`,
          full: `${PUBLIC_BASE}/${originalKey}`,
        }),
        key: originalKey,
        url: `${PUBLIC_BASE}/${originalKey}`,
        filename: filename || null,
        size_bytes: bytes.byteLength,
        mime_type,
        file_type,
        metadata: {},
      });
    }

    const key = safeKey(ext);

    await env.R2.put(key, bytes, {
      httpMetadata: { contentType: mime_type },
      customMetadata: {
        filename: filename || `upload.${ext}`,
        mime_type,
        file_type,
      },
    });

    const url = `${PUBLIC_BASE}/${key}`;

    return toJson({
      success: true,
      key,
      url,
      filename: filename || null,
      size_bytes: bytes.byteLength,
      mime_type,
      file_type,
      metadata: {},
    });
  } catch (e: any) {
    return toJson({ success: false, error: e?.message || "Upload failed" }, 500);
  }
};
