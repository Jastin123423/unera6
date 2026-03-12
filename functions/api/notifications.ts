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
  headers:{...cors,'Content-Type':'application/json'}
 });

export const onRequestOptions:PagesFunction = async () =>
 new Response(null,{status:204,headers:cors});

export const onRequestGet:PagesFunction<Env> = async ({request,env}) => {

 const userId = Number(request.headers.get("x-user-id"));
 if(!userId) return json({error:"unauthorized"},401);

 const {results} = await env.DB.prepare(`
  SELECT * FROM notifications
  WHERE recipient_id=?
  ORDER BY created_at DESC
  LIMIT 50
 `).bind(userId).all();

 return json(results);
};

export const onRequestPost:PagesFunction<Env> = async ({request,env}) => {

 const body = await request.json();

 const {
  recipient_id,
  actor_id,
  type,
  entity_type,
  entity_id,
  parent_id,
  message
 } = body;

 await env.DB.prepare(`
  INSERT INTO notifications
  (recipient_id,actor_id,type,entity_type,entity_id,parent_id,message)
  VALUES(?,?,?,?,?,?,?)
 `)
 .bind(recipient_id,actor_id,type,entity_type,entity_id,parent_id,message)
 .run();

 return json({success:true});
};
