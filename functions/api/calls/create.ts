import type { PagesFunction } from "@cloudflare/workers-types";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const safeNum = (v: any, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

const newId = () =>
  (globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "OPTIONS") return new Response("", { headers: cors });
  if (ctx.request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const me = safeNum(ctx.request.headers.get("x-user-id"));
  if (!me) return json({ error: "Missing x-user-id" }, 401);

  const body = await ctx.request.json().catch(() => ({}));
  const callee_id = safeNum(body?.callee_id);
  const call_type = body?.call_type === "video" ? "video" : "voice";

  if (!callee_id) return json({ error: "Missing callee_id" }, 400);

  const call_id = newId();

  await ctx.env.DB.prepare(
    `INSERT INTO calls (id, caller_id, callee_id, call_type, status) VALUES (?, ?, ?, ?, 'ringing')`
  )
    .bind(call_id, me, callee_id, call_type)
    .run();

  // Push “ringing” event to callee
  await ctx.env.DB.prepare(
    `INSERT INTO call_signals (call_id, from_user_id, to_user_id, type, payload)
     VALUES (?, ?, ?, 'offer', ?)`
  )
    .bind(call_id, me, callee_id, JSON.stringify({ ringing: true }))
    .run();

  return json({ ok: true, call_id, call_type });
};
