
import { SignJWT } from 'jose';
import { verifyUser, hashPassword, corsHeaders, Env } from '../auth_utils';

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export const onRequestOptions: any = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequest: any = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET /api/users/me
  if (url.pathname.endsWith('/me') && request.method === 'GET') {
    try {
      const userId = await verifyUser(request, env.JWT_SECRET);
      const user = await env.DB.prepare('SELECT id, username, email, profile_image_url, bio, location, is_verified, role FROM users WHERE id = ?')
        .bind(userId)
        .first();
      if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: jsonHeaders });
      return new Response(JSON.stringify(user), { headers: jsonHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }
  }

  // POST /api/users/login
  if (url.pathname.endsWith('/login') && request.method === 'POST') {
    const { email, password } = await request.json() as any;
    const user: any = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    
    if (!user) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: jsonHeaders });
    
    const requestHash = await hashPassword(password);
    if (requestHash !== user.password_hash) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: jsonHeaders });
    }

    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({ id: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);

    delete user.password_hash;
    return new Response(JSON.stringify({ token, user }), { headers: jsonHeaders });
  }

  // POST /api/users/signup
  if (url.pathname.endsWith('/signup') && request.method === 'POST') {
    const { username, email, password } = await request.json() as any;
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? OR username = ?').bind(email, username).first();
    if (existing) return new Response(JSON.stringify({ error: "User already exists" }), { status: 409, headers: jsonHeaders });

    const passHash = await hashPassword(password);
    const { meta } = await env.DB.prepare('INSERT INTO users (username, email, password_hash, profile_image_url) VALUES (?, ?, ?, ?)')
      .bind(username, email, passHash, `https://ui-avatars.com/api/?name=${username.replace(/\s/g, '+')}&background=random`)
      .run();

    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({ id: meta.last_row_id })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);

    return new Response(JSON.stringify({ token, user: { id: meta.last_row_id, username, email } }), { status: 201, headers: jsonHeaders });
  }

  // Default: GET /api/users
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, username, profile_image_url, bio, is_verified FROM users LIMIT 100').all();
    return new Response(JSON.stringify(results), { headers: jsonHeaders });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders });
};
