// functions/api/posts.ts  (GUEST FEED ONLY)
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const str = (v: any) => String(v ?? '').trim();
const toInt = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const safeJsonParseArray = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

// Cursor token: base64(JSON.stringify({ t: created_at, id }))
type CursorPayload = { t: string; id: number };
const encodeCursor = (p: CursorPayload) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(p))));
const decodeCursor = (token: string): CursorPayload | null => {
  try {
    const raw = decodeURIComponent(escape(atob(token)));
    const p = JSON.parse(raw);
    const t = String(p?.t ?? '').trim();
    const id = Number(p?.id ?? NaN);
    if (!t || !Number.isFinite(id)) return null;
    return { t, id };
  } catch {
    return null;
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'DB binding missing (DB)' }, 500);

    const url = new URL(request.url);
    const limit = clamp(toInt(url.searchParams.get('limit'), 20), 1, 50);
    const cursorToken = str(url.searchParams.get('cursor'));
    const cursor = cursorToken ? decodeCursor(cursorToken) : null;

    // guest sees PUBLIC only
    const where = cursor
      ? `WHERE (p.visibility IS NULL OR p.visibility = 'public')
           AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))`
      : `WHERE (p.visibility IS NULL OR p.visibility = 'public')`;

    const params: any[] = cursor ? [cursor.t, cursor.t, cursor.id, limit + 1] : [limit + 1];

    // ✅ NO p.type anywhere.
    // ✅ compute "type" from media_type/media_types
    const sql = `
      SELECT
        p.id,
        p.user_id,
        p.content,
        p.media_url,
        p.media_type,
        p.media_urls,
        p.media_types,
        p.visibility,
        p.location,
        p.feeling,
        p.tagged_users,
        p.background,
        p.link_preview,
        p.shares,
        p.views,
        p.created_at,

        -- OPTIONAL: join minimal author info for guest UI
        u.username AS author_username,
        u.name AS author_name,
        u.profile_image_url AS author_profile_image_url,
        u.is_verified AS author_is_verified,
        u.role AS author_role

      FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      ${where}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ?
    `;

    const res = await env.DB.prepare(sql).bind(...params).all();
    const rows = (res?.results || []) as any[];

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);

    const posts = pageRows.map((p: any) => {
      const media_urls = safeJsonParseArray(p?.media_urls);
      const media_types = safeJsonParseArray(p?.media_types);

      const media_url = p?.media_url ?? (media_urls[0] ?? null);
      const media_type = p?.media_type ?? (media_types[0] ?? null);

      // ✅ compute type (for UI) WITHOUT DB column
      const computedType = (() => {
        const t = String(media_type || '').toLowerCase();
        if (!t) return 'post';
        if (t.startsWith('image/')) return 'image';
        if (t.startsWith('video/')) return 'video';
        if (t.startsWith('audio/')) return 'audio';
        return 'post';
      })();

      return {
        id: Number(p?.id),
        user_id: p?.user_id == null ? null : Number(p?.user_id),
        content: p?.content ?? '',

        media_url,
        media_type,

        media_urls: media_urls.length ? media_urls : (media_url ? [media_url] : []),
        media_types: media_types.length ? media_types : (media_type ? [media_type] : []),

        visibility: p?.visibility ?? 'public',
        shares: Number(p?.shares ?? 0),
        views: Number(p?.views ?? 0),
        created_at: p?.created_at ?? new Date().toISOString(),

        // ✅ this is what your Feed UI can use
        type: computedType,

        // optional author helpers
        author_username: p?.author_username ?? null,
        author_name: p?.author_name ?? null,
        author_profile_image_url: p?.author_profile_image_url ?? null,
        author_is_verified: p?.author_is_verified ?? 0,
        author_role: p?.author_role ?? 'user',
      };
    });

    const last = posts[posts.length - 1];
    const nextCursor =
      hasMore && last?.created_at && last?.id
        ? encodeCursor({ t: String(last.created_at), id: Number(last.id) })
        : null;

    return json({ success: true, posts, nextCursor, hasMore });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Failed to fetch posts' }, 500);
  }
};
