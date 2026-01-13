
import { verifyUser, corsHeaders, Env } from '../auth_utils';

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export const onRequestOptions: any = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequest: any = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET /api/reels
  if (request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare(
        `SELECT r.*, u.username as author_name, u.profile_image_url as author_image 
         FROM reels r JOIN users u ON r.user_id = u.id 
         ORDER BY r.created_at DESC`
      ).all();
      
      const sanitized = (results || []).map((r: any) => ({
        ...r,
        reactions: [],
        comments: [],
        shares: r.shares || 0
      }));
      return new Response(JSON.stringify(sanitized), { headers: jsonHeaders });
    } catch (e) { return new Response(JSON.stringify([]), { headers: jsonHeaders }); }
  }

  // POST /api/reels
  if (request.method === 'POST') {
    try {
      const userId = await verifyUser(request, env.JWT_SECRET);
      const { video_url, caption, song_name } = await request.json() as any;
      const { meta } = await env.DB.prepare('INSERT INTO reels (user_id, video_url, caption, song_name) VALUES (?, ?, ?, ?)').bind(userId, video_url, caption || null, song_name || null).run();
      const newReel = await env.DB.prepare('SELECT * FROM reels WHERE id = ?').bind(meta.last_row_id).first();
      return new Response(JSON.stringify({ ...newReel, reactions: [], comments: [], shares: 0 }), { status: 201, headers: jsonHeaders });
    } catch (e) { return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders }); }
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders });
};
