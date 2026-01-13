
import { verifyUser, corsHeaders, Env } from '../auth_utils';

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export const onRequestOptions: any = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequest: any = async (context: any) => {
  const { request, env } = context;

  if (request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare(
        `SELECT p.*, u.username as seller_name, u.profile_image_url as seller_avatar 
         FROM products p JOIN users u ON p.seller_id = u.id 
         ORDER BY p.created_at DESC`
      ).all();
      const sanitized = (results || []).map((p: any) => ({
        ...p,
        images: JSON.parse(p.images || '[]'),
        ratings: JSON.parse(p.ratings || '[]')
      }));
      return new Response(JSON.stringify(sanitized), { headers: jsonHeaders });
    } catch (e) { return new Response(JSON.stringify([]), { headers: jsonHeaders }); }
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders });
};
