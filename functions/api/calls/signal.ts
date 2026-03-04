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
const safeStr = (v: any) => (typeof v === "string" ? v : "");

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method === "OPTIONS") return new Response("", { headers: cors });
  if (ctx.request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const me = safeNum(ctx.request.headers.get("x-user-id"));
  if (!me) return json({ error: "Missing x-user-id" }, 401);

  const body = await ctx.request.json().catch(() => ({}));
  const call_id = safeStr(body?.call_id);
  const to_user_id = safeNum(body?.to_user_id);
  const type = safeStr(body?.type);
  const payload = body?.payload ?? null;

  const allowed = new Set(["offer", "answer", "ice", "accept", "decline", "hangup"]);
  if (!call_id || !to_user_id || !allowed.has(type)) return json({ error: "Bad request" }, 400);

  await ctx.env.DB.prepare(
    `INSERT INTO call_signals (call_id, from_user_id, to_user_id, type, payload) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(call_id, me, to_user_id, type, payload ? JSON.stringify(payload) : null)
    .run();

  // Update call status for key types
  if (type === "accept") {
    await ctx.env.DB.prepare(`UPDATE calls SET status='accepted', updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(call_id)
      .run();
  }
  if (type === "decline") {
    await ctx.env.DB.prepare(`UPDATE calls SET status='declined', updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(call_id)
      .run();
  }
  if (type === "hangup") {
    await ctx.env.DB.prepare(`UPDATE calls SET status='ended', updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(call_id)
      .run();
  }

  return json({ ok: true });
};
