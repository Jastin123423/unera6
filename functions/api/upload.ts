import type { PagesFunction } from "@cloudflare/workers-types";

type Env = {
  R2: R2Bucket;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const PUBLIC_BASE = "https://media.unera.social"; // ✅ your custom domain

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.R2) {
      return Response.json({ error: "R2 binding missing (env.R2)" }, { status: 500, headers: cors });
    }

    const body = await request.json().catch(() => ({} as any));

    // expects: { filename, contentType, dataBase64 }
    const filename = String(body.filename || "").trim();
    const contentType = String(body.contentType || "application/octet-stream").trim();
    const dataBase64 = String(body.dataBase64 || "").trim();

    if (!filename) {
      return Response.json({ error: "filename is required" }, { status: 400, headers: cors });
    }
    if (!dataBase64) {
      return Response.json({ error: "dataBase64 is required" }, { status: 400, headers: cors });
    }

    // remove "data:*;base64," if present
    const base64 = dataBase64.includes("base64,") ? dataBase64.split("base64,")[1] : dataBase64;

    // decode
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // ✅ safe key
    const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
    const key = `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    await env.R2.put(key, bytes, {
      httpMetadata: { contentType },
    });

    const url = `${PUBLIC_BASE}/${key}`;

    return Response.json({ success: true, key, url }, { status: 200, headers: cors });
  } catch (e: any) {
    return Response.json(
      { success: false, error: e?.message || "Upload failed" },
      { status: 500, headers: cors }
    );
  }
};
