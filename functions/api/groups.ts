import { verifyUser, corsHeaders, Env } from '../auth_utils';

// @google/genai-api-fix: Replaced 'PagesFunction' with 'any' because it is not globally defined in this environment.
export const onRequestOptions: any = async () => {
  return new Response(null, { headers: corsHeaders });
};

// @google/genai-api-fix: Replaced 'PagesFunction<Env>' with 'any' because it is not globally defined in this environment.
export const onRequest: any = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');

  // POST /api/groups/:id/join
  if (pathParts.length === 5 && pathParts[4] === 'join' && request.method === 'POST') {
    try {
      const userId = await verifyUser(request, env.JWT_SECRET);
      const groupId = pathParts[3];
      const existing = await env.DB.prepare('SELECT id FROM group_members WHERE user_id = ? AND group_id = ?').bind(userId, groupId).first();
      if (existing) {
        await env.DB.prepare('DELETE FROM group_members WHERE id = ?').bind(existing.id).run();
        return new Response(JSON.stringify({ joined: false }), { headers: corsHeaders });
      } else {
        await env.DB.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)')
          .bind(groupId, userId, 'member').run();
        return new Response(JSON.stringify({ joined: true }), { headers: corsHeaders });
      }
    } catch (e) { return new Response("Unauthorized", { status: 401, headers: corsHeaders }); }
  }

  // GET /api/groups (List)
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count 
       FROM groups g WHERE g.type = 'public' ORDER BY created_at DESC`
    ).all();
    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // POST /api/groups (Create)
  if (request.method === 'POST') {
    try {
      const userId = await verifyUser(request, env.JWT_SECRET);
      const { name, description, type } = await request.json() as any;
      const { meta } = await env.DB.prepare('INSERT INTO groups (admin_id, name, description, type) VALUES (?, ?, ?, ?)').bind(userId, name, description, type).run();
      await env.DB.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)')
          .bind(meta.last_row_id, userId, 'admin').run();
      return new Response(JSON.stringify({ success: true, id: meta.last_row_id }), { status: 201, headers: corsHeaders });
    } catch (e) { return new Response("Unauthorized", { status: 401, headers: corsHeaders }); }
  }

  return new Response("Not Found", { status: 404 });
};