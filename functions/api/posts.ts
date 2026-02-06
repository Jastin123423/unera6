// functions/api/posts.ts  (GUEST FEED ONLY)
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const safeString = (v: any) => (typeof v === 'string' ? v : '');
const safeNumber = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const isHttpUrl = (v: any) => {
  if (typeof v !== 'string') return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeStringArray = (v: any): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x || '').trim()).filter(Boolean);
    } catch {}
  }
  return [];
};

// cursor token = base64(JSON.stringify({ t, id }))
type CursorPayload = { t: string; id: number };
const encodeCursor = (p: CursorPayload) => btoa(unescape(encodeURIComponent(JSON.stringify(p))));
const decodeCursor = (token: string): CursorPayload | null => {
  try {
    const raw = decodeURIComponent(escape(atob(token)));
    const p = JSON.parse(raw);
    const t = String(p?.t ?? '').trim();
    const id = Number(p?.id ?? NaN);
    if (!t || !Number.isFinite(id)) return null;
    return { t, id: Math.trunc(id) };
  } catch {
    return null;
  }
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: corsHeaders });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'D1 binding missing (DB)' }, 500);

    const body = await request.json().catch(() => ({} as any));

    const user_id = safeNumber(body.user_id, 0);
    if (!user_id) return json({ success: false, error: 'Login required (user_id missing).' }, 401);

    const content = safeString(body.content).trim();

    // single media (backward compatible)
    const media_url = body.media_url ?? null;
    const media_type = body.media_type ?? null;

    // multi media (new)
    const media_urls_arr = normalizeStringArray(body.media_urls);
    const media_types_arr = normalizeStringArray(body.media_types);

    const filtered_urls = media_urls_arr
      .filter((u) => !String(u).startsWith('data:'))
      .filter((u) => isHttpUrl(u));

    const filtered_types: string[] = [];
    for (let i = 0; i < filtered_urls.length; i++) {
      const t = String(media_types_arr[i] || '').trim();
      filtered_types.push(t || '');
    }

    const final_media_url =
      typeof media_url === 'string' && media_url.trim().length > 0
        ? media_url
        : (filtered_urls[0] ?? null);

    const final_media_type =
      typeof media_type === 'string' && media_type.trim().length > 0
        ? media_type
        : (filtered_types[0] ?? null);

    const hasSingle = typeof final_media_url === 'string' && final_media_url.trim().length > 0;
    const hasMulti = filtered_urls.length > 0;

    if (!content && !hasSingle && !hasMulti) {
      return json({ success: false, error: 'content or media_url or media_urls is required' }, 400);
    }

    if (typeof final_media_url === 'string' && final_media_url.startsWith('data:')) {
      return json(
        {
          success: false,
          error: 'Media upload not supported in base64.',
          message: 'Upload to R2/Cloudflare Images and store a normal https URL in media_url/media_urls.',
        },
        413
      );
    }

    if (typeof final_media_url === 'string' && final_media_url.length > 0 && !isHttpUrl(final_media_url)) {
      return json({ success: false, error: 'media_url must be a valid http/https URL' }, 400);
    }

    const media_urls_json = filtered_urls.length ? JSON.stringify(filtered_urls) : null;
    const media_types_json = filtered_urls.length ? JSON.stringify(filtered_types) : null;

    const result = await env.DB
      .prepare(
        `INSERT INTO posts (user_id, content, media_url, media_type, media_urls, media_types)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(user_id, content || null, final_media_url, final_media_type, media_urls_json, media_types_json)
      .run();

    const post_id = result.meta?.last_row_id;

    return json(
      {
        success: true,
        post_id,
        post: {
          id: post_id,
          user_id,
          content: content || '',
          media_url: final_media_url,
          media_type: final_media_type,
          media_urls: media_urls_json,
          media_types: media_types_json,
          visibility: body.visibility ?? 'public',
          created_at: new Date().toISOString(),
          views: 0,
          shares: 0,
        },
      },
      201
    );
  } catch (err: any) {
    return json({ success: false, error: String(err?.message ?? err) }, 500);
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'D1 binding missing (DB)' }, 500);

    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, safeNumber(url.searchParams.get('limit'), 20)));
    const cursorToken = safeString(url.searchParams.get('cursor')).trim();
    const cursor = cursorToken ? decodeCursor(cursorToken) : null;

    const where = cursor
  ? `WHERE LOWER(COALESCE(p.visibility,'public')) IN ('public','')
       AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))`
  : `WHERE LOWER(COALESCE(p.visibility,'public')) IN ('public','')`;

    const params: any[] = cursor ? [cursor.t, cursor.t, cursor.id, limit + 1] : [limit + 1];

    const q = `
      SELECT
        p.id, p.user_id, p.content,
        p.media_url, p.media_type,
        p.media_urls, p.media_types,
        p.visibility, p.created_at, p.views, p.shares,
        COALESCE(u.username,'user') AS username,
        COALESCE(u.username,'User') AS name,
        u.profile_image_url AS profile_image_url,
        COALESCE(u.is_verified,0) AS is_verified,
        COALESCE(u.role,'user') AS role,
        (SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) AS reactions_count
      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      ${where}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ?
    `;

    const { results } = await env.DB.prepare(q).bind(...params).all();
    const rows = Array.isArray(results) ? results : [];

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);

    const posts = pageRows.map((p: any) => {
      const media_urls = normalizeStringArray(p?.media_urls);
      const media_types = normalizeStringArray(p?.media_types);

      const media_url = p?.media_url ?? (media_urls[0] ?? null);
      const media_type = p?.media_type ?? (media_types[0] ?? null);

      const computedType = (() => {
        const t = String(media_type || '').toLowerCase();
        if (!t) return 'post';
        if (t.startsWith('image/')) return 'image';
        if (t.startsWith('video/')) return 'video';
        if (t.startsWith('audio/')) return 'audio';
        return 'post';
      })();

      return {
        ...p,
        media_url,
        media_type,
        media_urls: media_urls.length ? media_urls : (media_url ? [media_url] : []),
        media_types: media_types.length ? media_types : (media_type ? [media_type] : []),
        type: computedType, // ✅ UI uses this; DB does NOT need p.type
      };
    });

    const last = posts[posts.length - 1];
    const nextCursor =
      hasMore && last?.created_at && last?.id
        ? encodeCursor({ t: String(last.created_at), id: safeNumber(last.id, 0) })
        : null;

    return json({ success: true, posts, hasMore, nextCursor }, 200);
  } catch (err: any) {
    return json({ success: false, error: String(err?.message ?? err) }, 500);
  }
};
