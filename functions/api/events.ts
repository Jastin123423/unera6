
import { verifyUser, corsHeaders, Env } from '../auth_utils';

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

export const onRequestOptions: any = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const onRequest: any = async (context: any) => {
  const { request, env } = context;

  if (request.method === 'GET') {
    try {
      const { results } = await env.DB.prepare('SELECT * FROM events ORDER BY event_date ASC').all();
      const sanitized = (results || []).map((ev: any) => ({
        ...ev,
        attendees: JSON.parse(ev.attendees || '[]'),
        interested_ids: JSON.parse(ev.interested_ids || '[]')
      }));
      return new Response(JSON.stringify(sanitized), { headers: jsonHeaders });
    } catch (e) { return new Response(JSON.stringify([]), { headers: jsonHeaders }); }
  }

  if (request.method === 'POST') {
    try {
      const userId = await verifyUser(request, env.JWT_SECRET);
      const { title, description, event_date, location, cover_url } = await request.json() as any;
      const { meta } = await env.DB.prepare('INSERT INTO events (creator_id, title, description, event_date, location, cover_url, attendees, interested_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(userId, title, description || null, event_date, location, cover_url || null, JSON.stringify([userId]), JSON.stringify([]))
        .run();
      const newEvent = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(meta.last_row_id).first();
      return new Response(JSON.stringify(newEvent), { status: 201, headers: jsonHeaders });
    } catch (e) { return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders }); }
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: jsonHeaders });
};
