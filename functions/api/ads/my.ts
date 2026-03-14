import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,x-user-id",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = Number(request.headers.get("x-user-id"));
    if (!userId) return json({ error: "Missing user id" }, 400);

    const ads = await env.DB.prepare(`
      SELECT *
      FROM ads
      WHERE advertiser_id = ?
      ORDER BY created_at DESC
    `)
      .bind(userId)
      .all();

    // Parse JSON fields for each ad
    const parsedAds = ads.results.map((ad: any) => ({
      ...ad,
      media_urls: ad.media_urls ? JSON.parse(ad.media_urls) : [],
      media_types: ad.media_types ? JSON.parse(ad.media_types) : [],
      target_interests: ad.target_interests ? JSON.parse(ad.target_interests) : [],
      // Ensure boolean fields
      is_free: ad.is_free === 1
    }));

    return json({ ads: parsedAds });

  } catch (err) {
    console.error("Error fetching ads:", err);
    return json({ error: String(err) }, 500);
  }
};
