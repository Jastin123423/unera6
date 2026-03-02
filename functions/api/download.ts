import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { R2: R2Bucket };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: corsHeaders });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  if (!key) {
    return new Response(JSON.stringify({ success: false, error: "Missing key" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ✅ Security: only allow downloads from uploads folder
  if (!key.startsWith("uploads/")) {
    return new Response(JSON.stringify({ success: false, error: "Invalid key" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const obj = await env.R2.get(key);
  if (!obj) {
    return new Response(JSON.stringify({ success: false, error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const filename =
    obj.customMetadata?.filename ||
    key.split("/").pop() ||
    "download";

  const contentType =
    obj.httpMetadata?.contentType || "application/octet-stream";

  return new Response(obj.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
};
