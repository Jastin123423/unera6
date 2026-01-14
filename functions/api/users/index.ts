// functions/api/users/index.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const pickSafeUserFields = (u: any) => {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return rest;
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const method = request.method;
  const url = new URL(request.url);

  try {
    // ================================
    // GET USERS (LIST) OR GET USER (ONE)
    // ================================
    if (method === 'GET') {
      const id = url.searchParams.get('id');
      const username = url.searchParams.get('username');

      // ✅ LIST: /api/users
      if (!id && !username) {
        const { results } = await env.DB.prepare(
          `
          SELECT
            id, username, email,
            profile_image_url, cover_image_url,
            bio, work, education, location, website,
            birth_date, gender, nationality,
            is_verified, role,
            joined_date, created_at
          FROM users
          ORDER BY COALESCE(created_at, joined_date) DESC
        `
        ).all();

        // never return password_hash
        return json((results || []).map(pickSafeUserFields));
      }

      // ✅ ONE: /api/users?id=... OR ?username=...
      let query = '';
      let param: any = null;

      if (id) {
        query = 'SELECT * FROM users WHERE id = ?';
        param = id;
      } else {
        query = 'SELECT * FROM users WHERE username = ?';
        param = username;
      }

      const user = await env.DB.prepare(query).bind(param).first();
      if (!user) return json({ error: 'User not found' }, 404);

      return json(pickSafeUserFields(user));
    }

    // ================================
    // UPDATE USER  (PUT /api/users)
    // ================================
    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));

      const id = body?.id;
      if (!id) return json({ error: 'User id required' }, 400);

      const {
        bio,
        work,
        education,
        website,
        location,
        profile_image_url,
        cover_image_url,
      } = body;

      await env.DB.prepare(
        `
        UPDATE users SET
          bio = COALESCE(?, bio),
          work = COALESCE(?, work),
          education = COALESCE(?, education),
          website = COALESCE(?, website),
          location = COALESCE(?, location),
          profile_image_url = COALESCE(?, profile_image_url),
          cover_image_url = COALESCE(?, cover_image_url)
        WHERE id = ?
      `
      )
        .bind(
          bio ?? null,
          work ?? null,
          education ?? null,
          website ?? null,
          location ?? null,
          profile_image_url ?? null,
          cover_image_url ?? null,
          id
        )
        .run();

      // return updated user (useful for frontend)
      const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      return json({ success: true, user: pickSafeUserFields(updated) });
    }

    // ================================
    // DELETE USER  (DELETE /api/users?id=...)
    // ================================
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'User id required' }, 400);

      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
      return json({ success: true });
    }

    return json({ error: 'Method Not Allowed' }, 405);
  } catch (e: any) {
    if (String(e?.message || '').includes('UNIQUE')) {
      return json({ error: 'Username or email already exists' }, 409);
    }
    return json({ error: e?.message || 'Server error' }, 500);
  }
};
