// functions/api/users.ts
// Cloudflare Pages Function (single file route): /api/users
// Supports:
// - GET  /api/users              -> list latest 50 users (Facebook-like default)
// - GET  /api/users?list=1       -> list latest 50 users
// - GET  /api/users?id=1         -> get user by id
// - GET  /api/users?username=xx  -> get user by username
// - POST /api/users              -> signup (create user)
// - POST /api/users?action=login -> login
// - PUT  /api/users              -> update user
// - DELETE /api/users?id=1       -> delete user

export async function onRequest(context: any) {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);

  // ----------------------------
  // CORS
  // ----------------------------
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ----------------------------
  // Helpers
  // ----------------------------
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: corsHeaders });

  // Normalize email: trim + lowercase + remove spaces inside accidentally
  // Example: " ChapChaputz@Gmail.com  " -> "chapchaputz@gmail.com"
  // Example: "chapchaputz@gmail.com  " -> "chapchaputz@gmail.com"
  // Example: " chap chaputz@gmail.com " -> "chapchaputz@gmail.com" (removes ALL spaces)
  function normalizeEmail(email: any) {
    return String(email ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ""); // remove all spaces to keep uniform
  }

  // Normalize username: trim front/back, collapse multiple spaces inside to one
  function normalizeUsername(username: any) {
    return String(username ?? "")
      .trim()
      .replace(/\s+/g, " ");
  }

  async function hashPassword(password: string) {
    // Simple early-stage hashing (better than storing plain passwords)
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const action = url.searchParams.get("action"); // e.g. "login"

  try {
    // ================================
    // LOGIN  (POST /api/users?action=login)
    // ================================
    if (method === "POST" && action === "login") {
      const body = await request.json().catch(() => ({}));
      const email = normalizeEmail(body.email);
      const password = String(body.password ?? "");

      if (!email || !password) {
        return json({ error: "email and password are required" }, 400);
      }

      const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
        .bind(email)
        .first();

      if (!user) {
        return json({ error: "Invalid email or password" }, 401);
      }

      const incomingHash = await hashPassword(password);

      if (incomingHash !== (user as any).password_hash) {
        return json({ error: "Invalid email or password" }, 401);
      }

      // Never return password_hash
      delete (user as any).password_hash;

      return json({ success: true, user });
    }

    // ================================
    // SIGNUP / CREATE USER (POST /api/users)
    // ================================
    if (method === "POST" && !action) {
      const body = await request.json().catch(() => ({}));

      const username = normalizeUsername(body.username);
      const email = normalizeEmail(body.email);
      const password = String(body.password ?? "");

      const bio = body.bio ?? null;
      const location = body.location ?? null;
      const nationality = body.nationality ?? null;
      const gender = body.gender ?? null;
      const birth_date = body.birth_date ?? null;

      // Allow frontend to pass these, but optional
      const profile_image_url = body.profile_image_url ?? null;
      const cover_image_url = body.cover_image_url ?? null;

      if (!username || !email || !password) {
        return json({ error: "username, email and password are required" }, 400);
      }

      const password_hash = await hashPassword(password);

      const result = await env.DB.prepare(`
          INSERT INTO users (
            username, email, password_hash,
            profile_image_url, cover_image_url,
            bio, location, nationality, gender, birth_date,
            is_verified, role, joined_date, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'user', datetime('now'), datetime('now'))
        `)
        .bind(
          username,
          email,
          password_hash,
          profile_image_url,
          cover_image_url,
          bio,
          location,
          nationality,
          gender,
          birth_date
        )
        .run();

      return json({ success: true, user_id: result.meta.last_row_id }, 201);
    }

    // ================================
    // GET USER / LIST USERS (Facebook-like default)
    // ================================
    if (method === "GET") {
      const id = url.searchParams.get("id");
      const usernameParam = url.searchParams.get("username");
      const list = url.searchParams.get("list");

      // 1) Single user by id
      if (id) {
        const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
          .bind(id)
          .first();

        if (!user) return json({ error: "User not found" }, 404);

        delete (user as any).password_hash;
        return json(user);
      }

      // 2) Single user by username
      if (usernameParam) {
        const user = await env.DB
          .prepare("SELECT * FROM users WHERE username = ?")
          .bind(usernameParam)
          .first();

        if (!user) return json({ error: "User not found" }, 404);

        delete (user as any).password_hash;
        return json(user);
      }

      // 3) Default list users (either list=1 OR no params)
      if (list === "1" || (!id && !usernameParam)) {
        const { results } = await env.DB
          .prepare(
            `SELECT id, username,
                    profile_image_url, cover_image_url,
                    bio, location, joined_date, created_at
             FROM users
             ORDER BY created_at DESC
             LIMIT 50`
          )
          .all();

        return json(results);
      }
    }

    // ================================
    // UPDATE USER (PUT /api/users)
    // ================================
    if (method === "PUT") {
      const body = await request.json().catch(() => ({}));

      const id = body.id;

      if (!id) {
        return json({ error: "User id required" }, 400);
      }

      // Updateable fields
      const bio = body.bio ?? null;
      const work = body.work ?? null;
      const education = body.education ?? null;
      const website = body.website ?? null;
      const profile_image_url = body.profile_image_url ?? null;
      const cover_image_url = body.cover_image_url ?? null;

      const location = body.location ?? null;
      const nationality = body.nationality ?? null;
      const gender = body.gender ?? null;
      const birth_date = body.birth_date ?? null;

      // Optional: if you allow changing email, normalize it
      const emailRaw = body.email;
      const email = emailRaw !== undefined && emailRaw !== null ? normalizeEmail(emailRaw) : null;

      // Optional: allow changing username, normalize it
      const usernameRaw = body.username;
      const username = usernameRaw !== undefined && usernameRaw !== null ? normalizeUsername(usernameRaw) : null;

      await env.DB.prepare(`
          UPDATE users SET
            bio = COALESCE(?, bio),
            work = COALESCE(?, work),
            education = COALESCE(?, education),
            website = COALESCE(?, website),
            profile_image_url = COALESCE(?, profile_image_url),
            cover_image_url = COALESCE(?, cover_image_url),
            location = COALESCE(?, location),
            nationality = COALESCE(?, nationality),
            gender = COALESCE(?, gender),
            birth_date = COALESCE(?, birth_date),
            email = COALESCE(?, email),
            username = COALESCE(?, username)
          WHERE id = ?
        `)
        .bind(
          bio,
          work,
          education,
          website,
          profile_image_url,
          cover_image_url,
          location,
          nationality,
          gender,
          birth_date,
          email,
          username,
          id
        )
        .run();

      return json({ success: true });
    }

    // ================================
    // DELETE USER (DELETE /api/users?id=)
    // ================================
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return json({ error: "User id required" }, 400);
      }

      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      return json({ success: true });
    }

    // ================================
    // METHOD NOT ALLOWED
    // ================================
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  } catch (e: any) {
    const msg = String(e?.message || e);

    if (msg.includes("UNIQUE")) {
      return json({ error: "Username or email already exists" }, 409);
    }

    return json({ error: msg }, 500);
  }
}
