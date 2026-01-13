
import { verifyUser, corsHeaders, Env } from '../auth_utils';

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export const onRequestOptions: any = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequest: any = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    try {
      const now = new Date().toISOString();
      const { results } = await env.DB.prepare(
        `SELECT s.*, u.username as author_name, u.profile_image_url as author_image 
         FROM stories s JOIN users u ON s.user_id = u.id 
         WHERE s.expires_at > ? ORDER BY s.created_at DESC`
      ).bind(now).all();
      return new Response(JSON.stringify(results || []), { headers: jsonHeaders });
    } catch (e) { return new Response(JSON.stringify([]), { headers: jsonHeaders }); }
  }

  if (request.method === 'POST') {
    try {
      const userId = await verifyUser(request, env.JWT_SECRET);
      const body = await request.json() as any;
      const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { meta } = await env.DB.prepare('INSERT INTO stories (user_id, type, text_content, background_style, media_url, music_url, music_title, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(userId, body.type, body.text_content || null, body.background_style || null, body.media_url || null, body.music_url || null, body.music_title || null, expires_at)
        .run();
      const newStory = await env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(meta.last_row_id).first();
      return new Response(JSON.stringify(newStory), { status: 201, headers: jsonHeaders });
    } catch (e) { return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders }); }
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders });
};
