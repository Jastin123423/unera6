import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));
    const owner_id = Number(body.owner_id ?? 0);
    const name = String(body.name ?? "").trim();

    const description = body.description ?? null;
    const logo_url = body.logo_url ?? null;
    const category = body.category ?? null;

    if (!owner_id || !name) return json({ success: false, error: "Missing required fields" }, 400);

    const result = await env.DB
      .prepare(
        `INSERT INTO brands (owner_id, name, description, logo_url, category)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(owner_id, name, description, logo_url, category)
      .run();

    return json({ success: true, brand_id: result.meta.last_row_id });
  } catch (err: any) {
    return json({ success: false, error: err?.message ?? "Server error" }, 500);
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const url = new URL(request.url);
    const ownerId = Number(url.searchParams.get("owner_id") ?? 0);

    const stmt = ownerId
      ? env.DB.prepare("SELECT * FROM brands WHERE owner_id = ? ORDER BY created_at DESC").bind(ownerId)
      : env.DB.prepare("SELECT * FROM brands ORDER BY created_at DESC");

    const { results } = await stmt.all();

    // Return a consistent shape (easier for frontend)
    return json({ success: true, brands: results ?? [] });
  } catch (err: any) {
    return json({ success: false, error: err?.message ?? "Server error" }, 500);
  }
};
