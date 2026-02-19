// functions/api/brands.ts
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

const safeStr = (v: any) => String(v ?? "").trim();
const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// e.g. "UNERA Shoes" -> "unera.shoes"
const slugUsername = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24) || "brand";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const body = await request.json().catch(() => ({} as any));

    // Accept multiple keys to be compatible with your current frontend
    const owner_id = toInt(body.owner_id ?? body.admin_id ?? body.user_id ?? body.creator_id, 0);
    const name = safeStr(body.name);
    const description = safeStr(body.description) || null;
    const category = safeStr(body.category) || null;

    // Backend column is logo_url; frontend might send profile_image_url
    const logo_url =
      safeStr(body.logo_url ?? body.profile_image_url ?? body.avatar ?? body.image) || null;

    if (!owner_id || !name) return json({ success: false, error: "Missing owner_id or name" }, 400);

    // IMPORTANT: brands are followable via user_follows, so each brand needs a users row.
    // Your users.email is NOT NULL, so we auto-generate a unique placeholder email.
    const usernameBase = slugUsername(name);
    const suffix = Math.floor(Math.random() * 900000 + 100000); // 6 digits
    const username = `${usernameBase}.${suffix}`;
    const brandEmail = `brand+${username}@unera.social`;

    // 1) Create brand "user" row
    // NOTE: If your users table has additional NOT NULL columns besides email,
    // you must add them here too.
    const userIns = await env.DB
      .prepare(
        `INSERT INTO users (name, username, email, profile_image_url, role, created_at)
         VALUES (?, ?, ?, ?, 'brand', CURRENT_TIMESTAMP)`
      )
      .bind(name, username, brandEmail, logo_url)
      .run();

    const brand_user_id = Number(userIns.meta.last_row_id);

    // 2) Create brand metadata row
    // You must add the column once:
    // ALTER TABLE brands ADD COLUMN brand_user_id INTEGER;
    const brandIns = await env.DB
      .prepare(
        `INSERT INTO brands (owner_id, brand_user_id, name, description, logo_url, category)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(owner_id, brand_user_id, name, description, logo_url, category)
      .run();

    return json({
      success: true,
      brand_id: Number(brandIns.meta.last_row_id),
      brand_user_id,
    });
  } catch (err: any) {
    return json({ success: false, error: err?.message ?? "Server error" }, 500);
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: "DB binding missing (DB)" }, 500);

    const url = new URL(request.url);
    const ownerId = toInt(url.searchParams.get("owner_id"), 0);

    // LEFT JOIN so legacy brand rows (brand_user_id NULL) still show up.
    // Followers won't work for those rows until you backfill brand_user_id.
    const baseSql = `
      SELECT
        b.id,
        b.owner_id,
        b.brand_user_id,
        b.name,
        b.description,
        b.logo_url,
        b.category,
        b.created_at,

        u.username as brand_username,
        u.profile_image_url as profile_image_url,
        u.cover_image_url as cover_image_url,
        u.is_verified as is_verified,

        (SELECT COUNT(*) FROM user_follows uf WHERE uf.following_id = b.brand_user_id) as followers_count,

        COALESCE(
          (SELECT json_group_array(uf.follower_id)
           FROM user_follows uf
           WHERE uf.following_id = b.brand_user_id),
          '[]'
        ) as followers_json
      FROM brands b
      LEFT JOIN users u ON u.id = b.brand_user_id
    `;

    const stmt = ownerId
      ? env.DB.prepare(`${baseSql} WHERE b.owner_id = ? ORDER BY b.created_at DESC`).bind(ownerId)
      : env.DB.prepare(`${baseSql} ORDER BY b.created_at DESC`);

    const { results } = await stmt.all();

    const brands = (results ?? []).map((r: any) => {
      // parse followers
      let followers: number[] = [];
      try {
        const parsed = JSON.parse(r.followers_json ?? "[]");
        followers = Array.isArray(parsed)
          ? parsed.map((x: any) => Number(x)).filter((n: any) => Number.isFinite(n))
          : [];
      } catch {
        followers = [];
      }

      const brandName = safeStr(r.name) || "Brand";

      return {
        id: Number(r.id),
        owner_id: Number(r.owner_id),
        brand_user_id: r.brand_user_id != null ? Number(r.brand_user_id) : null,

        name: brandName,
        description: r.description ?? "",
        category: r.category ?? "",
        logo_url: r.logo_url ?? null,

        // match Brands.tsx expectations
        admin_id: Number(r.owner_id), // owner acts as admin in your UI
        profile_image_url:
          safeStr(r.profile_image_url) ||
          safeStr(r.logo_url) ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&background=random`,
        cover_image_url:
          safeStr(r.cover_image_url) ||
          "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1500&q=80",
        is_verified: Boolean(r.is_verified),

        brand_username: r.brand_username ?? null,

        followers,
        followers_count: Number(r.followers_count ?? followers.length),

        created_at: String(r.created_at ?? ""),
      };
    });

    return json({ success: true, brands });
  } catch (err: any) {
    return json({ success: false, error: err?.message ?? "Server error" }, 500);
  }
};
