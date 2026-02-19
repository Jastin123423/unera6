// functions/api/brands.ts
import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const safeStr = (v: any) => String(v ?? "").trim();
const safeNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const slugify = (s: string) =>
  safeStr(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "brand";

async function tableColumns(db: D1Database, table: string): Promise<Set<string>> {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all();
  const cols = new Set<string>();
  for (const r of (results as any[]) || []) cols.add(String(r?.name || ""));
  return cols;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Creates a "brand user" in users table if your schema supports/needs it.
 * This prevents NOT NULL failures for users.email / users.password_hash.
 */
async function createBrandUserIfSupported(db: D1Database, brandName: string, profileImageUrl?: string | null) {
  const userCols = await tableColumns(db, "users");

  // If users table doesn't exist / has no columns, skip.
  if (userCols.size === 0) return { brand_user_id: 0 };

  // If your app doesn't use brand_user_id, you can skip creation by not having this column in brands table.
  // We'll still create safely if possible.

  const now = new Date().toISOString();
  const base = slugify(brandName);
  const suffix = Math.random().toString(16).slice(2, 8);
  const username = `${base}_${suffix}`;

  const email = `${username}@brand.local`; // generated, not used for login
  const password_hash = await sha256Hex(`brand:${crypto.randomUUID()}`); // placeholder hash

  const insert: Record<string, any> = {};
  if (userCols.has("username")) insert.username = username;
  if (userCols.has("name")) insert.name = brandName;
  if (userCols.has("email")) insert.email = email;
  if (userCols.has("password_hash")) insert.password_hash = password_hash;
  if (userCols.has("profile_image_url")) insert.profile_image_url = profileImageUrl ?? null;
  if (userCols.has("is_verified")) insert.is_verified = 0;

  // role might have a CHECK constraint, so only set it if column exists
  // and use a common allowed value.
  if (userCols.has("role")) insert.role = "creator";

  if (userCols.has("created_at")) insert.created_at = now;

  // If required columns exist but we didn't set them, we must set them.
  // We already set email/password_hash if they exist.
  const keys = Object.keys(insert);
  if (!keys.length) return { brand_user_id: 0 };

  const colsSql = keys.map((k) => k).join(", ");
  const qMarks = keys.map(() => "?").join(", ");
  const values = keys.map((k) => insert[k]);

  const res = await db
    .prepare(`INSERT INTO users (${colsSql}) VALUES (${qMarks})`)
    .bind(...values)
    .run();

  return { brand_user_id: Number(res?.meta?.last_row_id || 0) };
}

/**
 * GET /api/brands
 * Returns { success:true, brands:[...] }
 * Adds followers[] based on user_follows where following_id = brand_user_id (preferred) else owner_id.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const brandCols = await tableColumns(env.DB, "brands");

    // Decide follow target column
    const hasBrandUserId = brandCols.has("brand_user_id");
    const hasOwnerId = brandCols.has("owner_id");

    const followTargetExpr = hasBrandUserId
      ? "COALESCE(b.brand_user_id, b.owner_id)"
      : hasOwnerId
        ? "b.owner_id"
        : "b.id";

    // Choose logo/profile field safely
    const logoExpr = brandCols.has("logo_url")
      ? "b.logo_url"
      : brandCols.has("profile_image_url")
        ? "b.profile_image_url"
        : "NULL";

    const coverExpr = brandCols.has("cover_image_url") ? "b.cover_image_url" : "NULL";

    const q = `
      SELECT
        b.*,
        ${logoExpr} AS logo_url,
        ${coverExpr} AS cover_image_url,

        COALESCE(
          (
            SELECT json_group_array(uf.follower_id)
            FROM user_follows uf
            WHERE uf.following_id = ${followTargetExpr}
          ),
          json('[]')
        ) AS followers

      FROM brands b
      ORDER BY b.created_at DESC
    `;

    const { results } = await env.DB.prepare(q).all();
    const brands = (results as any[]) || [];

    // Ensure followers is parsed array
    const normalized = brands.map((b) => {
      let followers: any[] = [];
      try {
        followers = Array.isArray(b.followers) ? b.followers : JSON.parse(b.followers || "[]");
      } catch {
        followers = [];
      }
      return { ...b, followers };
    });

    return json({ success: true, brands: normalized }, 200);
  } catch (err: any) {
    return json({ success: false, error: String(err?.message ?? err) }, 500);
  }
};

/**
 * POST /api/brands
 * Accepts either owner_id OR admin_id (App sends admin_id/owner_id)
 * Creates a brand "user" if brands.brand_user_id exists (so following works via user_follows).
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));

    const owner_id = safeNum(body.owner_id ?? body.admin_id, 0);
    const name = safeStr(body.name);
    if (!owner_id || !name) return json({ success: false, error: "owner_id/admin_id and name are required" }, 400);

    const brandCols = await tableColumns(env.DB, "brands");
    const hasBrandUserId = brandCols.has("brand_user_id");

    const profileImage =
      safeStr(body.profile_image_url ?? body.logo_url) || null;

    // Create brand user if supported/needed
    const { brand_user_id } = hasBrandUserId
      ? await createBrandUserIfSupported(env.DB, name, profileImage)
      : { brand_user_id: 0 };

    // Build insert payload only with columns that exist
    const insert: Record<string, any> = {};

    if (brandCols.has("owner_id")) insert.owner_id = owner_id;
    if (brandCols.has("admin_id")) insert.admin_id = owner_id; // if old schema uses admin_id
    if (brandCols.has("brand_user_id")) insert.brand_user_id = brand_user_id || null;

    if (brandCols.has("name")) insert.name = name;
    if (brandCols.has("description")) insert.description = safeStr(body.description) || null;
    if (brandCols.has("category")) insert.category = safeStr(body.category) || null;

    // image fields (your schema may have either)
    if (brandCols.has("logo_url")) insert.logo_url = safeStr(body.logo_url ?? body.profile_image_url) || null;
    if (brandCols.has("profile_image_url")) insert.profile_image_url = safeStr(body.profile_image_url ?? body.logo_url) || null;
    if (brandCols.has("cover_image_url")) insert.cover_image_url = safeStr(body.cover_image_url) || null;

    // optional business fields if you added them
    if (brandCols.has("website")) insert.website = safeStr(body.website) || null;
    if (brandCols.has("location")) insert.location = safeStr(body.location) || null;
    if (brandCols.has("contact_email")) insert.contact_email = safeStr(body.contact_email) || null;
    if (brandCols.has("contact_phone")) insert.contact_phone = safeStr(body.contact_phone) || null;

    if (brandCols.has("created_at")) insert.created_at = new Date().toISOString();

    const keys = Object.keys(insert);
    if (!keys.length) return json({ success: false, error: "brands table has no writable columns" }, 500);

    const colsSql = keys.join(", ");
    const qMarks = keys.map(() => "?").join(", ");
    const values = keys.map((k) => insert[k]);

    const res = await env.DB
      .prepare(`INSERT INTO brands (${colsSql}) VALUES (${qMarks})`)
      .bind(...values)
      .run();

    const brand_id = Number(res?.meta?.last_row_id || 0);

    // Return created brand in the shape App.tsx expects (it normalizes data.brand ?? data)
    const brand = {
      id: brand_id,
      ...insert,
      followers: [],
    };

    return json({ success: true, brand_id, brand }, 201);
  } catch (err: any) {
    return json({ success: false, error: String(err?.message ?? err) }, 500);
  }
};
