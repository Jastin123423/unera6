// functions/api/posts.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,PATCH,OPTIONS',
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

    const where = cursor
      ? `WHERE (visibility IS NULL OR visibility = 'public')
           AND (created_at < ? OR (created_at = ? AND id < ?))`
      : `WHERE (visibility IS NULL OR visibility = 'public')`;

    const params: any[] = cursor ? [cursor.t, cursor.t, cursor.id, limit + 1] : [limit + 1];

    const sql = `
      SELECT
        id,
        user_id,
        content,
        media_url,
        media_type,
        media_urls,
        media_types,
        visibility,
        location,
        feeling,
        tagged_users,
        background,
        link_preview,
        shares,
        views,
        created_at
      FROM posts
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `;

    const res = await env.DB.prepare(sql).bind(...params).all();
    const rows = (res?.results || []) as any[];

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map((p: any) => {
      const media_urls = safeJsonParseArray(p?.media_urls);
      const media_types = safeJsonParseArray(p?.media_types);

      const media_url = p?.media_url ?? (media_urls[0] ?? null);
      const media_type = p?.media_type ?? (media_types[0] ?? null);

      return {
        ...p,
        id: Number(p?.id),
        user_id: p?.user_id == null ? null : Number(p?.user_id),
        content: p?.content ?? '',
        media_url,
        media_type,
        media_urls: media_urls.length ? media_urls : (media_url ? [media_url] : []),
        media_types: media_types.length ? media_types : (media_type ? [media_type] : []),
        shares: Number(p?.shares ?? 0),
        views: Number(p?.views ?? 0),
        created_at: p?.created_at ?? new Date().toISOString(),
      };
    });

    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last?.created_at && last?.id
        ? encodeCursor({ t: String(last.created_at), id: Number(last.id) })
        : null;

    return json({ success: true, posts: page, nextCursor, hasMore });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Failed to fetch posts' }, 500);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'DB binding missing (DB)' }, 500);

    const body = await request.json().catch(() => ({}));
    const user_id = toInt(body?.user_id, 0);
    const content = str(body?.content);
    const visibility = str(body?.visibility) || 'public';

    const media_url = body?.media_url ? str(body.media_url) : null;
    const media_type = body?.media_type ? str(body.media_type) : null;

    const media_urls = Array.isArray(body?.media_urls) ? body.media_urls : undefined;
    const media_types = Array.isArray(body?.media_types) ? body.media_types : undefined;

    const created_at = str(body?.created_at) || new Date().toISOString();

    if (!user_id) return json({ success: false, error: 'user_id is required' }, 400);
    if (!content && !media_url && !(media_urls && media_urls.length) && !str(body?.background)) {
      return json({ success: false, error: 'Post content or media is required' }, 400);
    }

    const insert = `
      INSERT INTO posts (
        user_id, content,
        media_url, media_type,
        media_urls, media_types,
        visibility, location, feeling,
        tagged_users, background, link_preview,
        shares, views,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const info = await env.DB.prepare(insert).bind(
      user_id,
      content || null,
      media_url,
      media_type,
      media_urls ? JSON.stringify(media_urls) : null,
      media_types ? JSON.stringify(media_types) : null,
      visibility,
      body?.location ?? null,
      body?.feeling ?? null,
      body?.tagged_users ? JSON.stringify(body.tagged_users) : null,
      body?.background ?? null,
      body?.link_preview ? JSON.stringify(body.link_preview) : null,
      toInt(body?.shares, 0),
      toInt(body?.views, 0),
      created_at
    ).run();

    const id = Number(info?.meta?.last_row_id ?? 0);

    return json({
      success: true,
      post: {
        id,
        user_id,
        content,
        media_url,
        media_type,
        media_urls: media_urls?.length ? media_urls : (media_url ? [media_url] : []),
        media_types: media_types?.length ? media_types : (media_type ? [media_type] : []),
        visibility,
        shares: 0,
        views: 0,
        created_at,
      },
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Failed to create post' }, 500);
  }
};
