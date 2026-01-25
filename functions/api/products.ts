// functions/api/products.ts
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({}));

    const seller_id = Number(body.seller_id || 0);
    const title = String(body.title || "").trim();
    const category = String(body.category || "").trim();
    const description = String(body.description || "").trim();
    const country = String(body.country || "").trim();
    const address = String(body.address || "").trim();
    const main_price = Number(body.main_price);
    const discount_price =
      body.discount_price === null || body.discount_price === undefined
        ? null
        : Number(body.discount_price);
    const quantity = Number(body.quantity ?? 1);
    const phone_number = body.phone_number ? String(body.phone_number).trim() : null;
    const images = Array.isArray(body.images) ? body.images : [];

    if (!seller_id || !title || !category || !description || !country || !address) {
      return Response.json({ success: false, error: "Missing required fields" }, { status: 400, headers: cors });
    }
    if (!Number.isFinite(main_price)) {
      return Response.json({ success: false, error: "Invalid main_price" }, { status: 400, headers: cors });
    }

    const result = await env.DB.prepare(`
      INSERT INTO products
      (seller_id, title, category, description, country, address, main_price,
       discount_price, quantity, phone_number, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        seller_id,
        title,
        category,
        description,
        country,
        address,
        main_price,
        discount_price,
        quantity,
        phone_number,
        JSON.stringify(images)
      )
      .run();

    const id = result?.meta?.last_row_id;

    // Return created product with seller info
    const created = await env.DB.prepare(`
      SELECT
        p.*,
        u.name AS seller_name,
        u.username AS seller_username,
        u.profile_image_url AS seller_avatar
      FROM products p
      JOIN users u ON u.id = p.seller_id
      WHERE p.id = ?
    `)
      .bind(id)
      .first();

    const safeImages = (() => {
      try {
        const raw = (created as any)?.images;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    return Response.json(
      {
        success: true,
        product: { ...(created as any), images: safeImages },
      },
      { headers: cors }
    );
  } catch (e: any) {
    return Response.json(
      { success: false, error: e?.message || "Failed to create product" },
      { status: 500, headers: cors }
    );
  }
};

export const onRequestGet: PagesFunction = async ({ env }) => {
  try {
    const { results } = await env.DB.prepare(`
      SELECT
        p.*,
        u.name AS seller_name,
        u.username AS seller_username,
        u.profile_image_url AS seller_avatar
      FROM products p
      JOIN users u ON u.id = p.seller_id
      ORDER BY p.created_at DESC
    `).all();

    const normalized = (Array.isArray(results) ? results : []).map((r: any) => {
      let imgs: any[] = [];
      try {
        const parsed = typeof r.images === "string" ? JSON.parse(r.images) : r.images;
        imgs = Array.isArray(parsed) ? parsed : [];
      } catch {
        imgs = [];
      }
      return { ...r, images: imgs };
    });

    return Response.json(normalized, { headers: cors });
  } catch (e: any) {
    return Response.json(
      { success: false, error: e?.message || "Failed to fetch products" },
      { status: 500, headers: cors }
    );
  }
};
