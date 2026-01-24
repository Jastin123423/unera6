import type { PagesFunction } from "@cloudflare/workers-types";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const safeNum = (v: any) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const safeStr = (v: any) => String(v ?? "").trim();

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  try {
    const songId = safeNum((params as any)?.id);
    if (!songId) return Response.json({ error: "Invalid song id" }, { status: 400, headers: cors });

    const body = await request.json().catch(() => ({} as any));
    const user_id = body.user_id == null ? null : safeNum(body.user_id) || null;
    const guest_key = safeStr(body.guest_key) || null;

    // allow guest, but require at least one identity for dedupe
    // if you want to count even without guest_key, you can (but dedupe is weaker)
    const identityOk = Boolean(user_id) || Boolean(guest_key);

    // DEDUPE WINDOW (seconds)
    const WINDOW = 30;

    // Optional: use request.cf for IP fingerprint (hashed) if you want
    // For simplicity: skip ip_hash (or implement hashing)
    const ip_hash = null;

    // If we can dedupe, check recent play
    if (identityOk) {
      const recent = await env.DB.prepare(`
        SELECT id FROM audio_play_events
        WHERE track_type = 'music'
          AND track_id = ?
          AND (
            (user_id IS NOT NULL AND user_id = ?)
            OR
            (guest_key IS NOT NULL AND guest_key = ?)
          )
          AND created_at > datetime('now', ?)
        LIMIT 1
      `)
        .bind(songId, user_id, guest_key, `-${WINDOW} seconds`)
        .first();

      if (recent) {
        // don't increment again in the window
        const row = await env.DB.prepare(`SELECT plays_count FROM songs WHERE id = ?`).bind(songId).first();
        return Response.json({ success: true, plays_count: Number((row as any)?.plays_count || 0), deduped: true }, { status: 200, headers: cors });
      }
    }

    // record event (optional but recommended)
    await env.DB.prepare(`
      INSERT INTO audio_play_events (track_type, track_id, user_id, guest_key, ip_hash)
      VALUES ('music', ?, ?, ?, ?)
    `).bind(songId, user_id, guest_key, ip_hash).run();

    // increment counter (this is what UI uses)
    await env.DB.prepare(`UPDATE songs SET plays_count = plays_count + 1 WHERE id = ?`).bind(songId).run();

    const updated = await env.DB.prepare(`SELECT plays_count FROM songs WHERE id = ?`).bind(songId).first();

    return Response.json(
      { success: true, plays_count: Number((updated as any)?.plays_count || 0) },
      { status: 200, headers: cors }
    );
  } catch (e: any) {
    return Response.json({ error: e?.message || "Server error" }, { status: 500, headers: cors });
  }
};
