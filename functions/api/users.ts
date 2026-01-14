// functions/api/users.ts
export async function onRequest(context: any) {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);

  // ----------------------------
  // CORS (adjust origin if needed)
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

  async function hashPassword(password: string) {
    // Simple hashing for early stage (better than storing plain passwords)
    // Later you can upgrade to stronger hashing (bcrypt/argon2 via separate service).
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // ----------------------------
  // ROUTING
  // ----------------------------
  // Single-file approach:
  // - Signup: POST /api/users
  // - Login:  POST /api/users?action=login
  const action = url.searchParams.get("action"); // e.g. "login"

  try {
    // ================================
    // LOGIN  (POST /api/users?action=login)
    // ================================
    if (method === "POST" && action === "login") {
      const { email, password } = await request.json();

      if (!email || !password) {
        return json({ error: "email and password are required" }, 400);
      }

      const user = await env.DB.prepare(
        "SELECT * FROM users WHERE email = ?"
      )
        .bind(email)
        .first();

      if (!user) {
        return json({ error: "Invalid email or password" }, 401);
      }

      const incomingHash = await hashPassword(password);

      if (incomingHash !== user.password_hash) {
        return json({ error: "Invalid email or password" }, 401);
      }

      // Never return password_hash
      delete (user as any).password_hash;

      // If you want tokens later, generate JWT here.
      return json({ success: true, user });
    }

    // ================================
    // SIGNUP / CREATE USER (POST /api/users)
    // ================================
    if (method === "POST" && !action) {
      const {
        username,
        email,
        password, // frontend sends password
        bio,
        location,
        nationality,
        gender,
        birth_date,
      } = await request.json();

      if (!username || !email || !password) {
        return json({ error: "username, email and password are required" }, 400);
      }

      // basic normalization
      const cleanEmail = String(email).trim().toLowerCase();
      const cleanUsername = String(username).trim();

      // hash password on backend
      const password_hash = await hashPassword(String(password));

      const result = await env.DB.prepare(`
          INSERT INTO users (
            username, email, password_hash,
            bio, location, nationality, gender, birth_date,
            is_verified, role, joined_date, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'user', datetime('now'), datetime('now'))
        `)
        .bind(
          cleanUsername,
          cleanEmail,
          password_hash,
          bio ?? null,
          location ?? null,
          nationality ?? null,
          gender ?? null,
          birth_date ?? null
        )
        .run();

      return json({ success: true, user_id: result.meta.last_row_id }, 201);
    }

    // ================================
    // GET USER (GET /api/users?id= OR ?username=)
    // ================================
    if (method === "GET") {
      const id = url.searchParams.get("id");
      const username = url.searchParams.get("username");

      let query: string | null = null;
      let param: any = null;

      if (id) {
        query = "SELECT * FROM users WHERE id = ?";
        param = id;
      } else if (username) {
        query = "SELECT * FROM users WHERE username = ?";
        param = username;
      } else {
        return json({ error: "Provide id or username" }, 400);
      }

      const user = await env.DB.prepare(query).bind(param).first();

      if (!user) {
        return json({ error: "User not found" }, 404);
      }

      delete (user as any).password_hash;
      return json(user);
    }

    // ================================
    // UPDATE USER (PUT /api/users)
    // ================================
    if (method === "PUT") {
      const {
        id,
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
      } = await request.json();

      if (!id) {
        return json({ error: "User id required" }, 400);
      }

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
            birth_date = COALESCE(?, birth_date)
          WHERE id = ?
        `)
        .bind(
          bio ?? null,
          work ?? null,
          education ?? null,
          website ?? null,
          profile_image_url ?? null,
          cover_image_url ?? null,
          location ?? null,
          nationality ?? null,
          gender ?? null,
          birth_date ?? null,
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
