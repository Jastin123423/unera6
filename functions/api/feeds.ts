import type { PagesFunction } from "@cloudflare/workers-types";

type Env = {
  DB: D1Database;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 20);
    const cursor = Number(url.searchParams.get("cursor") || 0);

    /* -----------------------------
       1️⃣ FETCH POSTS
    ------------------------------*/

    const postsQuery = `
      SELECT 
        p.*,
        u.name AS author_name,
        u.profile_image_url,
        u.is_verified
      FROM posts p
      LEFT JOIN users u ON u.id = p.author_id
      WHERE p.id < ?
      ORDER BY p.id DESC
      LIMIT ?
    `;

    const postsRes = await env.DB.prepare(postsQuery)
      .bind(cursor || 999999999, limit)
      .all();

    const posts = postsRes.results || [];

    /* -----------------------------
       2️⃣ FETCH ACTIVE ADS
    ------------------------------*/

    const adsQuery = `
      SELECT 
        a.*,
        u.name AS advertiser_name,
        u.profile_image_url AS advertiser_image,
        u.is_verified
      FROM ads a
      LEFT JOIN users u ON u.id = a.advertiser_id
      WHERE a.status = 'active'
      AND (a.start_date IS NULL OR a.start_date <= datetime('now'))
      AND (a.end_date IS NULL OR a.end_date >= datetime('now'))
      ORDER BY RANDOM()
      LIMIT 10
    `;

    const adsRes = await env.DB.prepare(adsQuery).all();
    const ads = adsRes.results || [];

    /* -----------------------------
       3️⃣ MIX POSTS + ADS
    ------------------------------*/

    const feed: any[] = [];
    let adIndex = 0;

    for (let i = 0; i < posts.length; i++) {

      /* NORMAL POST */
      feed.push({
        type: "post",
        ...posts[i],
        author: {
          id: posts[i].author_id,
          name: posts[i].author_name,
          profile_image_url: posts[i].profile_image_url,
          is_verified: posts[i].is_verified
        }
      });

      /* INSERT AD EVERY 4 POSTS */
      if ((i + 1) % 4 === 0 && ads[adIndex]) {

        const ad = ads[adIndex];

        feed.push({
          type: "ad",
          id: ad.id,

          headline: ad.title,
          description: ad.description,

          cta_text: ad.cta_button || "Learn More",
          cta_url: ad.destination_url,

          media_url: ad.media_url,
          media_urls: ad.media_urls
            ? JSON.parse(ad.media_urls)
            : ad.media_url
            ? [ad.media_url]
            : [],

          media_type: ad.media_type,

          advertiser: {
            id: ad.advertiser_id,
            name: ad.advertiser_name,
            profile_image_url: ad.advertiser_image,
            is_verified: ad.is_verified
          },

          reason: "Based on your interests",

          likes: ad.impressions || 0,
          comments: 0,
          shares: 0
        });

        adIndex++;

        if (adIndex >= ads.length) {
          adIndex = 0;
        }
      }
    }

    /* -----------------------------
       4️⃣ NEXT CURSOR
    ------------------------------*/

    const nextCursor =
      posts.length > 0 ? posts[posts.length - 1].id : null;

    return new Response(
      JSON.stringify({
        success: true,
        data: feed,
        next_cursor: nextCursor
      }),
      {
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      }
    );

  } catch (err: any) {

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message
      }),
      {
        status: 500,
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      }
    );
  }
};
