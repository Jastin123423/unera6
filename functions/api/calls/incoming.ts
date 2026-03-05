import type { PagesFunction } from "@cloudflare/workers-types";
type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const toInt = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fb;
};

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "OPTIONS") return new Response("", { headers: cors });
  if (ctx.request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const me = toInt(ctx.request.headers.get("x-user-id"));
  if (!me) return json({ error: "Missing x-user-id" }, 401);

  const r = await ctx.env.DB.prepare(
    `SELECT id, caller_id, callee_id, call_type, status, created_at
     FROM calls
     WHERE callee_id=? AND status='ringing'
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(me)
    .first();

  return json({ ok: true, call: r || null });
};
