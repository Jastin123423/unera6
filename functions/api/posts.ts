import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const safeString = (v: any) => (typeof v === "string" ? v : "");
const safeNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const isHttpUrl = (v: any) => {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const normalizeStringArray = (v: any): string[] => {
  if (Array.isArray(v)) {
    return v.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x || "").trim()).filter(Boolean);
      }
    } catch {}
  }
  return [];
};

const normalizeMediaMetaArray = (v: any): any[] => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
  }
  return [];
};

const normCreatedAt = (v: any) => {
  const s = String(v ?? "").trim();
  return s || "1970-01-01 00:00:00";
};

const normalizeMediaType = (v: any, fallback = "image") => {
  const t = String(v || "").trim().toLowerCase();
  if (t === "image" || t === "video" || t === "audio") return t;
  return fallback;
};

const inferTypeFromUrl = (url: string) => {
  const u = String(url || "").toLowerCase();
  if (
    u.includes(".mp4") ||
    u.includes(".webm") ||
    u.includes(".mov") ||
    u.includes(".m4v") ||
    u.includes(".m3u8")
  ) {
    return "video";
  }
  if (
    u.includes(".mp3") ||
    u.includes(".wav") ||
    u.includes(".ogg") ||
    u.includes(".m4a") ||
    u.includes(".aac")
  ) {
    return "audio";
  }
  return "image";
};

const cleanUrl = (v: any) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s === "null" || s === "undefined") return "";
  if (s.startsWith("data:")) return "";
  return s;
};

const parseMediaMeta = (raw: any, maxItems = 20) => {
  let arr: any[] = [];

  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    const s = raw.trim();
    if (s && s.length <= 100000) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) arr = parsed;
      } catch {}
    }
  }

  return arr
    .slice(0, maxItems)
    .map((m: any) => {
      const thumb = cleanUrl(m?.thumb || m?.thumbnail_url);
      const feed = cleanUrl(
        m?.feed || m?.feed_url || m?.url || m?.full || m?.full_url
      );
      const full = cleanUrl(
        m?.full || m?.full_url || m?.feed || m?.feed_url || m?.url || m?.thumb
      );
      const type = String(m?.type || "")
        .trim()
        .toLowerCase();

      const finalType =
        type === "image" || type === "video" || type === "audio"
          ? type
          : inferTypeFromUrl(full || feed || thumb);

      return {
        thumb: isHttpUrl(thumb) ? thumb : null,
        feed: isHttpUrl(feed) ? feed : null,
        full: isHttpUrl(full) ? full : null,
        type: finalType,
      };
    })
    .filter((m) => m.thumb || m.feed || m.full);
};

const normalizeMedia = (row: any) => {
  const meta = parseMediaMeta(row?.media_meta);

  if (meta.length > 0) {
    return {
      media: meta,
      media_url: meta[0]?.feed || meta[0]?.full || meta[0]?.thumb || null,
      media_urls: meta.map((m: any) => m.feed || m.full || m.thumb).filter(Boolean),
      media_types: meta.map(
        (m: any) => m.type || inferTypeFromUrl(m.feed || m.full || m.thumb)
      ),
      images: meta
        .filter((m: any) => (m.type || "").toLowerCase() === "image")
        .map((m: any) => m.feed || m.full || m.thumb)
        .filter(Boolean),
      thumb_url: meta[0]?.thumb || null,
      feed_url: meta[0]?.feed || null,
      full_url: meta[0]?.full || null,
    };
  }

  const mediaUrls = normalizeStringArray(row?.media_urls);
  const mediaTypes = normalizeStringArray(row?.media_types);
  const singleUrl = cleanUrl(row?.media_url);
  const outUrls = mediaUrls.length ? mediaUrls : singleUrl ? [singleUrl] : [];

  let outTypes = mediaTypes.length ? mediaTypes : [];
  if (outUrls.length && outTypes.length !== outUrls.length) {
    outTypes = outUrls.map(inferTypeFromUrl);
  }

  const media = outUrls.map((url, i) => {
    const type = normalizeMediaType(outTypes[i], inferTypeFromUrl(url));
    return {
      thumb: type === "image" ? url : null,
      feed: url,
      full: url,
      type,
    };
  });

  return {
    media,
    media_url: singleUrl || outUrls[0] || null,
    media_urls: outUrls,
    media_types: outTypes,
    images: outUrls,
    thumb_url: media[0]?.thumb || null,
    feed_url: media[0]?.feed || null,
    full_url: media[0]?.full || null,
  };
};

const normalizePostMedia = (item: any) => {
  const media = normalizeMedia(item).media;
  return Array.isArray(media) ? media : [];
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        500
      );
    }

    const body = await request.json().catch(() => ({} as any));
    const content = safeString(body.content).trim();
    const media_url = body.media_url ?? null;
    const media_type = body.media_type ?? null;

    const user_id = body.user_id ?? null;

    const media_urls_arr = normalizeStringArray(body.media_urls);
    const media_types_arr = normalizeStringArray(body.media_types);
    const media_meta_arr = normalizeMediaMetaArray(body.media_meta);

    const filtered_urls = media_urls_arr
      .filter((u) => !String(u).startsWith("data:"))
      .filter((u) => isHttpUrl(u));

    const filtered_types: string[] = [];
    for (let i = 0; i < filtered_urls.length; i++) {
      const t = String(media_types_arr[i] || "").trim();
      filtered_types.push(t || "");
    }

    const mediaMetaFeedUrls = media_meta_arr
      .map((item: any) =>
        String(
          item?.feed ||
            item?.feed_url ||
            item?.url ||
            item?.full ||
            item?.full_url ||
            item?.thumb ||
            ""
        ).trim()
      )
      .filter((u: string) => isHttpUrl(u));

    const mediaMetaTypes = media_meta_arr.map((item: any) =>
      String(
        item?.type || inferTypeFromUrl(item?.full || item?.feed || item?.thumb || "")
      ).trim()
    );

    const final_multi_urls =
      filtered_urls.length > 0 ? filtered_urls : mediaMetaFeedUrls;

    const final_multi_types =
      filtered_types.length > 0 ? filtered_types : mediaMetaTypes;

    const final_media_url =
      typeof media_url === "string" && media_url.trim().length > 0
        ? media_url
        : final_multi_urls[0] ?? null;

    const final_media_type =
      typeof media_type === "string" && media_type.trim().length > 0
        ? media_type
        : final_multi_types[0] ?? null;

    const hasSingle =
      typeof final_media_url === "string" && final_media_url.trim().length > 0;
    const hasMulti = final_multi_urls.length > 0;

    if (!content && !hasSingle && !hasMulti) {
      return json(
        { error: "content or media_url or media_urls is required" },
        400
      );
    }

    if (
      typeof final_media_url === "string" &&
      final_media_url.startsWith("data:")
    ) {
      return json(
        {
          error: "Media upload not supported in base64.",
          message:
            "Upload to R2/Cloudflare Images and store a normal https URL in media_url/media_urls.",
        },
        413
      );
    }

    if (
      typeof final_media_url === "string" &&
      final_media_url.length > 0 &&
      !isHttpUrl(final_media_url)
    ) {
      return json({ error: "media_url must be a valid http/https URL" }, 400);
    }

    const media_urls_json = final_multi_urls.length
      ? JSON.stringify(final_multi_urls)
      : null;
    const media_types_json = final_multi_types.length
      ? JSON.stringify(final_multi_types)
      : null;
    const media_meta_json = media_meta_arr.length
      ? JSON.stringify(media_meta_arr)
      : null;

    let result: D1Result<any>;
    let insertedWithMediaMeta = true;

    try {
      result = await env.DB.prepare(
        `INSERT INTO posts (user_id, content, media_url, media_type, media_urls, media_types, media_meta, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          user_id,
          content || null,
          final_media_url,
          final_media_type,
          media_urls_json,
          media_types_json,
          media_meta_json,
          body.visibility ?? "public"
        )
        .run();
    } catch {
      insertedWithMediaMeta = false;
      result = await env.DB.prepare(
        `INSERT INTO posts (user_id, content, media_url, media_type, media_urls, media_types, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          user_id,
          content || null,
          final_media_url,
          final_media_type,
          media_urls_json,
          media_types_json,
          body.visibility ?? "public"
        )
        .run();
    }

    const post_id = result.meta?.last_row_id;

    return json(
      {
        success: true,
        post_id,
        post: {
          id: post_id,
          user_id,
          content: content || "",
          media_url: final_media_url,
          media_type: final_media_type,
          media_urls: media_urls_json,
          media_types: media_types_json,
          media_meta: insertedWithMediaMeta ? media_meta_json : null,
          media: insertedWithMediaMeta
            ? normalizePostMedia({
                media_url: final_media_url,
                media_type: final_media_type,
                media_urls: media_urls_json,
                media_types: media_types_json,
                media_meta: media_meta_json,
              })
            : normalizePostMedia({
                media_url: final_media_url,
                media_type: final_media_type,
                media_urls: media_urls_json,
                media_types: media_types_json,
              }),
          visibility: body.visibility ?? "public",
          created_at: new Date().toISOString(),
          views: 0,
          shares: 0,
          source: "post",
          item_type: "post",
          feed_key: `post:${post_id}`,
        },
      },
      201
    );
  } catch (err: any) {
    return json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) {
      return json(
        { error: "D1 binding missing. Set Pages D1 binding name to DB." },
        500
      );
    }

    const url = new URL(request.url);
    const limit = clamp(toInt(url.searchParams.get("limit"), 50), 1, 100);
    const viewerId = toInt(url.searchParams.get("viewerId"), 0);
    const perType = clamp(Math.ceil(limit * 2.0), 20, 160);

    // ============================================================
    // NORMAL POSTS — broad like old SELECT *, but enriched
    // ============================================================
    const qPosts = `
      SELECT
        'post' AS source,
        'post' AS item_type,

        p.id AS id,
        ('post:' || CAST(p.id AS TEXT)) AS feed_key,
        p.created_at AS created_at,

        p.id AS post_id,
        NULL AS group_post_id,

        p.user_id AS user_id,
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

        p.content AS content,
        p.visibility AS visibility,
        COALESCE(p.views, 0) AS views,
        COALESCE(p.shares, 0) AS shares,

        CASE
          WHEN p.media_url LIKE 'data:%' THEN NULL
          WHEN length(p.media_url) > 300 THEN NULL
          ELSE p.media_url
        END AS media_url,

        CASE
          WHEN p.media_url LIKE 'data:%' THEN NULL
          WHEN length(p.media_url) > 300 THEN NULL
          ELSE p.media_type
        END AS media_type,

        CASE
          WHEN p.media_urls LIKE 'data:%' THEN NULL
          WHEN length(p.media_urls) > 5000 THEN NULL
          ELSE p.media_urls
        END AS media_urls,

        CASE
          WHEN length(p.media_types) > 5000 THEN NULL
          ELSE p.media_types
        END AS media_types,

        CASE
          WHEN length(p.media_meta) > 100000 THEN NULL
          ELSE p.media_meta
        END AS media_meta,

        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,

        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count,
        (SELECT pr.type FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = ? LIMIT 1) AS my_reaction,

        (
          SELECT COALESCE(u2.name, u2.username, '')
          FROM post_reactions pr2
          JOIN users u2 ON u2.id = pr2.user_id
          WHERE pr2.post_id = p.id
          ORDER BY pr2.created_at DESC, pr2.id DESC
          LIMIT 1
        ) AS reactor_name,

        (
          SELECT json_group_array(
            json_object(
              'user_id', x.user_id,
              'type', x.type,
              'name', x.name,
              'profile_image_url', x.profile_image_url
            )
          )
          FROM (
            SELECT
              pr3.user_id AS user_id,
              LOWER(COALESCE(pr3.type,'like')) AS type,
              COALESCE(u3.name, u3.username, '') AS name,
              CASE
                WHEN u3.profile_image_url LIKE 'data:%' THEN NULL
                WHEN length(u3.profile_image_url) > 300 THEN NULL
                ELSE u3.profile_image_url
              END AS profile_image_url
            FROM post_reactions pr3
            LEFT JOIN users u3 ON u3.id = pr3.user_id
            WHERE pr3.post_id = p.id
            ORDER BY pr3.created_at DESC, pr3.id DESC
            LIMIT 30
          ) x
        ) AS reactions_preview,

        (
          SELECT json_group_array(
            json_object('type', t.type, 'count', t.c)
          )
          FROM (
            SELECT LOWER(COALESCE(type,'like')) AS type, COUNT(*) AS c
            FROM post_reactions
            WHERE post_id = p.id
            GROUP BY LOWER(COALESCE(type,'like'))
            ORDER BY c DESC
          ) t
        ) AS reactions_by_type,

        NULL AS group_id,
        NULL AS group_name,
        NULL AS group_image

      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      WHERE
        (
          p.visibility IS NULL
          OR TRIM(LOWER(p.visibility)) = 'public'
          OR TRIM(p.visibility) = ''
          OR TRIM(LOWER(p.visibility)) = 'public'
          OR TRIM(LOWER(p.visibility)) = 'worldwide'
        )
        AND (
          COALESCE(LOWER(p.media_type), '') NOT LIKE '%video%'
          AND COALESCE(LOWER(p.media_url), '') NOT LIKE '%.mp4%'
          AND COALESCE(LOWER(p.media_url), '') NOT LIKE '%.webm%'
          AND COALESCE(LOWER(p.media_url), '') NOT LIKE '%.mov%'
          AND COALESCE(LOWER(p.media_url), '') NOT LIKE '%.m4v%'
          AND COALESCE(LOWER(p.media_url), '') NOT LIKE '%.m3u8%'
          AND COALESCE(LOWER(p.media_urls), '') NOT LIKE '%.mp4%'
          AND COALESCE(LOWER(p.media_urls), '') NOT LIKE '%.webm%'
          AND COALESCE(LOWER(p.media_urls), '') NOT LIKE '%.mov%'
          AND COALESCE(LOWER(p.media_urls), '') NOT LIKE '%.m4v%'
          AND COALESCE(LOWER(p.media_urls), '') NOT LIKE '%.m3u8%'
          AND (p.media_meta IS NULL OR LOWER(p.media_meta) NOT LIKE '%"type":"video"%')
        )
      ORDER BY p.created_at DESC
      LIMIT ?
    `;

    // ============================================================
    // GROUP POSTS — broad like old, but enriched
    // ============================================================
    const qGroupPosts = `
      SELECT
        'group_post' AS source,
        'group_post' AS item_type,

        gp.id AS id,
        ('group_post:' || CAST(gp.id AS TEXT)) AS feed_key,
        gp.created_at AS created_at,

        NULL AS post_id,
        gp.id AS group_post_id,

        gp.user_id AS user_id,
        COALESCE(u.username, 'user') AS username,
        COALESCE(u.name, u.username, 'User') AS name,
        CASE
          WHEN u.profile_image_url LIKE 'data:%' THEN NULL
          WHEN length(u.profile_image_url) > 300 THEN NULL
          ELSE u.profile_image_url
        END AS profile_image_url,
        COALESCE(u.is_verified, 0) AS is_verified,
        COALESCE(u.role, 'user') AS role,

        gp.content AS content,
        gp.visibility AS visibility,
        0 AS views,
        0 AS shares,

        CASE
          WHEN gp.media_url LIKE 'data:%' THEN NULL
          WHEN length(gp.media_url) > 300 THEN NULL
          ELSE gp.media_url
        END AS media_url,

        CASE
          WHEN gp.media_urls LIKE 'data:%' THEN NULL
          WHEN length(gp.media_urls) > 5000 THEN NULL
          ELSE gp.media_urls
        END AS media_urls,

        CASE
          WHEN gp.media_url IS NOT NULL AND gp.media_url != '' THEN 'image'
          ELSE NULL
        END AS media_type,

        NULL AS media_types,
        NULL AS media_meta,

        (SELECT COUNT(*) FROM group_post_comments gpc WHERE gpc.group_post_id = gp.id) AS comments_count,

        (SELECT COUNT(*) FROM group_post_reactions gpr WHERE gpr.group_post_id = gp.id) AS reactions_count,
        (SELECT gpr.type FROM group_post_reactions gpr WHERE gpr.group_post_id = gp.id AND gpr.user_id = ? LIMIT 1) AS my_reaction,

        (
          SELECT COALESCE(u2.name, u2.username, '')
          FROM group_post_reactions gpr2
          JOIN users u2 ON u2.id = gpr2.user_id
          WHERE gpr2.group_post_id = gp.id
          ORDER BY gpr2.created_at DESC, gpr2.id DESC
          LIMIT 1
        ) AS reactor_name,

        (
          SELECT json_group_array(
            json_object(
              'user_id', x.user_id,
              'type', x.type,
              'name', x.name,
              'profile_image_url', x.profile_image_url
            )
          )
          FROM (
            SELECT
              gpr3.user_id AS user_id,
              LOWER(COALESCE(gpr3.type,'like')) AS type,
              COALESCE(u3.name, u3.username, '') AS name,
              CASE
                WHEN u3.profile_image_url LIKE 'data:%' THEN NULL
                WHEN length(u3.profile_image_url) > 300 THEN NULL
                ELSE u3.profile_image_url
              END AS profile_image_url
            FROM group_post_reactions gpr3
            LEFT JOIN users u3 ON u3.id = gpr3.user_id
            WHERE gpr3.group_post_id = gp.id
            ORDER BY gpr3.created_at DESC, gpr3.id DESC
            LIMIT 30
          ) x
        ) AS reactions_preview,

        (
          SELECT json_group_array(
            json_object('type', t.type, 'count', t.c)
          )
          FROM (
            SELECT LOWER(COALESCE(type,'like')) AS type, COUNT(*) AS c
            FROM group_post_reactions
            WHERE group_post_id = gp.id
            GROUP BY LOWER(COALESCE(type,'like'))
            ORDER BY c DESC
          ) t
        ) AS reactions_by_type,

        gp.group_id AS group_id,
        COALESCE(g.name, 'Group') AS group_name,
        CASE
          WHEN g.profile_image LIKE 'data:%' THEN NULL
          WHEN length(g.profile_image) > 300 THEN NULL
          ELSE g.profile_image
        END AS group_image

      FROM group_posts gp
      LEFT JOIN users u ON u.id = gp.user_id
      LEFT JOIN groups g ON g.id = gp.group_id
      WHERE
        (
          gp.visibility IS NULL
          OR TRIM(LOWER(gp.visibility)) = 'public'
          OR TRIM(gp.visibility) = ''
        )
        AND COALESCE(LOWER(gp.media_url), '') NOT LIKE '%.mp4%'
        AND COALESCE(LOWER(gp.media_url), '') NOT LIKE '%.webm%'
        AND COALESCE(LOWER(gp.media_url), '') NOT LIKE '%.mov%'
        AND COALESCE(LOWER(gp.media_url), '') NOT LIKE '%.m4v%'
        AND COALESCE(LOWER(gp.media_url), '') NOT LIKE '%.m3u8%'
      ORDER BY gp.created_at DESC
      LIMIT ?
    `;

    const [postsRes, groupPostsRes] = await Promise.all([
      env.DB.prepare(qPosts).bind(viewerId || 0, perType).all(),
      env.DB.prepare(qGroupPosts).bind(viewerId || 0, perType).all(),
    ]);

    const items = [
      ...(Array.isArray(postsRes.results) ? postsRes.results : []),
      ...(Array.isArray(groupPostsRes.results) ? groupPostsRes.results : []),
    ];

    const map = new Map<string, any>();
    for (const it of items) {
      const k = String(it?.feed_key || `${it?.source}:${it?.id}`);
      if (!map.has(k)) map.set(k, it);
    }

    const merged = Array.from(map.values())
      .sort((a, b) =>
        normCreatedAt(b.created_at).localeCompare(normCreatedAt(a.created_at))
      )
      .slice(0, limit)
      .map((item) => {
        const mediaNormalized = normalizeMedia(item);
        const media = Array.isArray(mediaNormalized.media) ? mediaNormalized.media : [];

        return {
          ...item,
          ...mediaNormalized,
          media,
          media_count: media.length,
          thumb_url: mediaNormalized.thumb_url || null,
          feed_url: mediaNormalized.feed_url || null,
          full_url: mediaNormalized.full_url || null,
          comments_count: Number(item?.comments_count ?? 0),
          reactions_count: Number(item?.reactions_count ?? 0),
          shares: Number(item?.shares ?? 0),
        };
      });

    return json(Array.isArray(merged) ? merged : [], 200);
  } catch (err: any) {
    return json(
      { error: "Backend crash", message: String(err?.message ?? err) },
      500
    );
  }
};
