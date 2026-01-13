export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const {
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
    images
  } = await request.json()

  const result = await env.DB.prepare(`
    INSERT INTO products
    (seller_id, title, category, description, country, address, main_price,
     discount_price, quantity, phone_number, images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    seller_id,
    title,
    category,
    description,
    country,
    address,
    main_price,
    discount_price ?? null,
    quantity,
    phone_number ?? null,
    JSON.stringify(images ?? [])
  ).run()

  return Response.json({ success: true, product_id: result.meta.last_row_id })
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  const { results } = await env.DB
    .prepare("SELECT * FROM products ORDER BY created_at DESC")
    .all()

  return Response.json(results)
}
