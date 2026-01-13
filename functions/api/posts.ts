
import { verifyUser, corsHeaders, Env } from '../auth_utils';

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export const onRequestOptions: any = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequest: any = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');

  // GET /api/posts/:id/comments
  if (pathParts.length === 5 && pathParts[4] === 'comments' && request.method === 'GET') {
    const postId = pathParts[3];
    const { results } = await env.DB.prepare(
      `SELECT c.*, u.username as author_name, u.profile_image_url as author_image 
       FROM post_comments c JOIN users u ON c.user_id = u.id 
       WHERE c.post_id = ? ORDER BY c.created_at ASC`
    ).bind(postId).all();
    return new Response(JSON.stringify(results), { headers: jsonHeaders });
  }

  // POST /api/posts/:id/like
  if (pathParts.length === 5 && pathParts[4] === 'like' && request.method === 'POST') {
    try {
      const userId = await verifyUser(request, env.JWT_SECRET);
      const postId = pathParts[3];
      const existing = await env.DB.prepare('SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?').bind(userId, postId).first();
      if (existing) {
        await env.DB.prepare('DELETE FROM post_likes WHERE id = ?').bind(existing.id).run();
        return new Response(JSON.stringify({ liked: false }), { headers: jsonHeaders });
      } else {
        await env.DB.prepare('INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)').bind(userId, postId).run();
        return new Response(JSON.stringify({ liked: true }), { headers: jsonHeaders });
      }
    } catch (e) { return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders }); }
  }

  // POST /api/posts (Create)
  if (request.method === 'POST') {
    try {
      const userId = await verifyUser(request, env.JWT_SECRET);
      const { content, media_url } = await request.json() as any;
      const { meta } = await env.DB.prepare('INSERT INTO posts (user_id, content, media_url) VALUES (?, ?, ?)').bind(userId, content || null, media_url || null).run();
      const newPost = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(meta.last_row_id).first();
      return new Response(JSON.stringify(newPost), { status: 201, headers: jsonHeaders });
    } catch (e) { return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders }); }
  }

  // GET /api/posts (List)
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT p.*, u.username as author_name, u.profile_image_url as author_image 
       FROM posts p JOIN users u ON p.user_id = u.id 
       ORDER BY p.created_at DESC LIMIT 50`
    ).all();
    return new Response(JSON.stringify(results), { headers: jsonHeaders });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders });
};
