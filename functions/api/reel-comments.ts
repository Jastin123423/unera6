import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const cleanText = (v: any) => String(v ?? '').trim();
const cleanUrl = (v: any) => String(v ?? '').trim();

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

/**
 * POST /api/reel-comments
 * Body JSON:
 * {
 *   reel_id: number,
 *   text?: string,
 *   user_id?: number,
 *   parent_comment_id?: number | null,
 *   image_url?: string
 * }
 *
 * Note:
 * - emoji works automatically inside text
 * - image upload file itself should be uploaded first to /api/upload
 *   then send returned image_url here
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await request.json().catch(() => ({}));
    } else {
      body = await request.json().catch(() => ({}));
    }

    const reel_id = toNum(body.reel_id, 0);
    const headerUserId = toNum(request.headers.get('x-user-id'), 0);
    const bodyUserId = toNum(body.user_id, 0);
    const user_id = headerUserId || bodyUserId || 0;

    const text = cleanText(body.text);
    const image_url = cleanUrl(body.image_url);
    const parent_comment_id = body.parent_comment_id == null
      ? null
      : toNum(body.parent_comment_id, 0);

    if (!reel_id) {
      return json({ success: false, error: 'reel_id is required' }, 400);
    }

    if (!user_id) {
      return json({ success: false, error: 'user_id is required' }, 400);
    }

    if (!text && !image_url) {
      return json({ success: false, error: 'text or image_url is required' }, 400);
    }

    if (text.length > 2000) {
      return json({ success: false, error: 'Comment is too long' }, 400);
    }

    const reel = await env.DB
      .prepare(`SELECT id FROM reels WHERE id = ? LIMIT 1`)
      .bind(reel_id)
      .first();

    if (!reel) {
      return json({ success: false, error: 'Reel not found' }, 404);
    }

    const user = await env.DB
      .prepare(`SELECT id FROM users WHERE id = ? LIMIT 1`)
      .bind(user_id)
      .first();

    if (!user) {
      return json({ success: false, error: 'User not found' }, 404);
    }

    if (parent_comment_id) {
      const parent = await env.DB
        .prepare(
          `SELECT id, reel_id
           FROM reel_comments
           WHERE id = ?
           LIMIT 1`
        )
        .bind(parent_comment_id)
        .first();

      if (!parent) {
        return json({ success: false, error: 'Parent comment not found' }, 404);
      }

      if (toNum((parent as any).reel_id, 0) !== reel_id) {
        return json({ success: false, error: 'Parent comment does not belong to this reel' }, 400);
      }
    }

    const ins = await env.DB
      .prepare(
        `INSERT INTO reel_comments (
          user_id,
          reel_id,
          parent_comment_id,
          text,
          image_url
        )
        VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        user_id,
        reel_id,
        parent_comment_id,
        text,
        image_url || null
      )
      .run();

    const comment_id = Number(ins.meta.last_row_id || 0);

    const comment = await env.DB
      .prepare(
        `SELECT
          rc.id,
          rc.reel_id,
          rc.user_id,
          rc.parent_comment_id,
          rc.text,
          rc.image_url,
          rc.created_at
        FROM reel_comments rc
        WHERE rc.id = ?
        LIMIT 1`
      )
      .bind(comment_id)
      .first();

    const countRow = await env.DB
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM reel_comments
         WHERE reel_id = ?`
      )
      .bind(reel_id)
      .first();

    const comments_count = toNum((countRow as any)?.cnt, 0);

    return json({
      success: true,
      comment: comment ?? {
        id: comment_id,
        reel_id,
        user_id,
        parent_comment_id,
        text,
        image_url: image_url || null,
      },
      comments_count,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};

/**
 * GET /api/reel-comments?reel_id=123
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const reel_id = toNum(url.searchParams.get('reel_id'), 0);

    if (!reel_id) {
      return json({ success: false, error: 'reel_id required' }, 400);
    }

    const reel = await env.DB
      .prepare(`SELECT id FROM reels WHERE id = ? LIMIT 1`)
      .bind(reel_id)
      .first();

    if (!reel) {
      return json({ success: false, error: 'Reel not found' }, 404);
    }

    const res = await env.DB
      .prepare(
        `SELECT
          rc.id,
          rc.reel_id,
          rc.user_id,
          rc.parent_comment_id,
          rc.text,
          rc.image_url,
          rc.created_at
        FROM reel_comments rc
        WHERE rc.reel_id = ?
        ORDER BY
          CASE WHEN rc.parent_comment_id IS NULL THEN 0 ELSE 1 END ASC,
          COALESCE(rc.parent_comment_id, rc.id) DESC,
          rc.created_at ASC,
          rc.id ASC
        LIMIT 500`
      )
      .bind(reel_id)
      .all();

    const comments = Array.isArray(res.results) ? res.results : [];

    const countRow = await env.DB
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM reel_comments
         WHERE reel_id = ?`
      )
      .bind(reel_id)
      .first();

    const comments_count = toNum((countRow as any)?.cnt, comments.length);

    return json({
      success: true,
      comments,
      comments_count,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Server error' }, 500);
  }
};
