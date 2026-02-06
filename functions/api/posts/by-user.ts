// functions/api/posts/by-user.ts
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

// ✅ Change these table names if yours differ
const REACTIONS_TABLE = 'post_reactions'; // <-- if yours is "reactions" or "post_likes", change here.

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.DB) return json({ success: false, error: 'DB binding missing (DB)' }, 500);

    const url = new URL(request.url);
    const userId = toInt(url.searchParams.get('userId'), 0);
    const viewerId = toInt(url.searchParams.get('viewerId'), 0);

    if (!userId) return json({ success: false, error: 'userId is required' }, 400);

    const limit = clamp(toInt(url.searchParams.get('limit'), 30), 1, 50);
    const cursorToken = str(url.searchParams.get('cursor'));
    const cursor = cursorToken ? decodeCursor(cursorToken) : null;

    // ✅ Visibility:
    // - If viewer is profile owner: show all
    // - Else: show public only
    const visibilityWhere =
      viewerId && viewerId === userId
        ? `1=1`
        : `(p.visibility IS NULL OR p.visibility = 'public')`;

    const cursorWhere = cursor
      ? `AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))`
      : '';

    const params: any[] = cursor
      ? [userId, ...(viewerId ? [viewerId, viewerId] : [0, 0]), cursor.t, cursor.t, cursor.id, limit + 1]
      : [userId, ...(viewerId ? [viewerId, viewerId] : [0, 0]), limit + 1];

    // ✅ NOTE:
    // D1 is SQLite. We compute:
    // - reactions_count: count(*) on reactions table
    // - my_reaction: viewer's reaction type (or null)
    //
    // If you also need comments_count, add another subquery.
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
        p.type,
        p.location,
        p.feeling,
        p.tagged_users,
        p.background,
        p.link_preview,
        p.shares,
        p.views,
        p.created_at,

        -- total reactions
        (
          SELECT COUNT(1)
          FROM ${REACTIONS_TABLE} pr
          WHERE pr.post_id = p.id
        ) AS reactions_count,

        -- viewer reaction (single)
        (
          SELECT pr2.type
          FROM ${REACTIONS_TABLE} pr2
          WHERE pr2.post_id = p.id AND pr2.user_id = ?
          ORDER BY pr2.id DESC
          LIMIT 1
        ) AS my_reaction

      FROM posts p
      WHERE p.user_id = ?
        AND ${visibilityWhere}
        ${cursorWhere}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ?
    `;

    // Bind order matters (because viewer subquery uses viewerId first)
    // We used params as: [userId, viewerId, viewerId, cursor..., limit+1]
    // But SQL expects: my_reaction bind (viewerId) first, then userId, then cursor binds, then limit.
    // So we must bind correctly:
    const bindParams: any[] = [];
    bindParams.push(viewerId || 0);
    bindParams.push(userId);

    if (cursor) {
      bindParams.push(cursor.t, cursor.t, cursor.id);
    }
    bindParams.push(limit + 1);

    const res = await env.DB.prepare(sql).bind(...bindParams).all();
    const rows = (res?.results || []) as any[];

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map((p: any) => {
      const media_urls = safeJsonParseArray(p?.media_urls);
      const media_types = safeJsonParseArray(p?.media_types);

      const media_url = p?.media_url ?? (media_urls[0] ?? null);
      const media_type = p?.media_type ?? (media_types[0] ?? null);

      const reactions_count = Number(p?.reactions_count ?? 0);
      const my_reaction = p?.my_reaction ?? null;

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
        reactions_count,
        reactionsCount: reactions_count, // compatibility with your App normalize
        likesCount: reactions_count,     // compatibility with your UI
        my_reaction,
        myReaction: my_reaction,
      };
    });

    const last = page[page.length - 1];
    const nextCursor = hasMore && last?.created_at && last?.id
      ? encodeCursor({ t: String(last.created_at), id: Number(last.id) })
      : null;

    return json({ success: true, posts: page, nextCursor, hasMore });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Failed to fetch user posts' }, 500);
  }
};
