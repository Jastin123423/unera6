import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
};

const json = (data:any,status=200)=>
 new Response(JSON.stringify(data),{
  status,
  headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}
 });

export const onRequestOptions:PagesFunction = async () =>
 new Response(null,{status:204,headers:cors});

export const onRequestGet:PagesFunction<Env> = async ({request,env}) => {

 const userId = Number(request.headers.get("x-user-id"));

 if(!userId) return json({error:"Unauthorized"},401);

 const {results} = await env.DB.prepare(`
SELECT
 n.group_key,
 n.type,
 n.entity_type,
 n.entity_id,

 COUNT(*) as total,
 MAX(n.created_at) as created_at,

 json_group_array(
  json_object(
   'id',u.id,
   'name',u.name,
   'avatar',u.profile_image_url,
   'verified',u.is_verified
  )
 ) as actors

FROM notifications n
JOIN users u ON u.id=n.actor_id

WHERE n.recipient_id=?

GROUP BY n.group_key

ORDER BY created_at DESC
LIMIT 50
`)
.bind(userId)
.all();

 return json(results);
};
