import type { PagesFunction } from "@cloudflare/workers-types";
import { createNotification } from "../../../utils/createNotification";

type Env = { DB: D1Database };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeType = (v: any) => String(v || "like").trim().toLowerCase();

const ALLOWED_REACTIONS = [
  "like",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
  "fire",
  "party",
  "clap",
  "star",
  "thinking",
  "crying",
  "heart_eyes",
  "kiss",
  "sunglasses",
  "rocket",
  "trophy",
  "crown",
];

const buildReactionMessage = (type: string) => {
  const t = normalizeType(type);

  if (t === "love") return "loved your song";
  if (t === "haha") return "laughed at your song";
  if (t === "wow") return "reacted wow to your song";
  if (t === "sad") return "felt sad about your song";
  if (t === "angry") return "felt angry about your song";
  if (t === "fire") return "fired up your song";
  if (t === "party") return "celebrated your song";
  if (t === "clap") return "applauded your song";
  if (t === "star") return "starred your song";
  if (t === "thinking") return "reacted thoughtfully to your song";
  if (t === "crying") return "cried over your song";
  if (t === "heart_eyes") return "reacted heart-eyes to your song";
  if (t === "kiss") return "kissed your song";
  if (t === "sunglasses") return "reacted cool to your song";
  if (t === "rocket") return "rocketed your song";
  if (t === "trophy") return "awarded your song";
  if (t === "crown") return "crowned your song";

  return "reacted to your song";
};

export const onRequestPost: PagesFunction = async ({ request, env, params }) => {
  try {
    if (!env.DB) {
      return json({ success: false, error: "DB binding missing (DB)" }, 500);
    }

    const songId = toNum((params as any)?.id, 0);
    const body = await request.json().catch(() => ({} as any));
    const headerUserId = toNum(request.headers.get("x-user-id"), 0);
    const bodyUserId = toNum(body.user_id, 0);
    const userId = headerUserId || bodyUserId || 0;
    const type = normalizeType(body.type || "like");

    if (!songId) {
      return json({ success: false, error: "Invalid song id" }, 400);
    }

    if (!userId) {
      return json({ success: false, error: "user_id is required" }, 400);
    }

    if (!ALLOWED_REACTIONS.includes(type)) {
      return json({ success: false, error: "Invalid reaction type" }, 400);
    }

    const song = await env.DB.prepare(
      `SELECT id, uploader_id
       FROM songs
       WHERE id = ?
       LIMIT 1`
    ).bind(songId).first();

    if (!song) {
      return json({ success: false, error: "Song not found" }, 404);
    }

    const songOwnerId = toNum((song as any)?.uploader_id, 0);

    const existing = await env.DB.prepare(
      `SELECT id, type
       FROM song_reactions
       WHERE song_id = ? AND user_id = ?
       LIMIT 1`
    ).bind(songId, userId).first();

    let reacted = false;
    let finalType: string | null = null;

    if ((existing as any)?.id) {
      const prev = normalizeType((existing as any)?.type || "like");

      if (prev === type) {
        await env.DB.prepare(
          `DELETE FROM song_reactions
           WHERE song_id = ? AND user_id = ?`
        ).bind(songId, userId).run();

        reacted = false;
        finalType = null;
      } else {
        await env.DB.prepare(
          `UPDATE song_reactions
           SET type = ?, created_at = datetime('now')
           WHERE id = ?`
        ).bind(type, (existing as any).id).run();

        reacted = true;
        finalType = type;
      }
    } else {
      await env.DB.prepare(
        `INSERT INTO song_reactions (song_id, user_id, type)
         VALUES (?, ?, ?)`
      ).bind(songId, userId, type).run();

      reacted = true;
      finalType = type;
    }

    if (reacted && finalType) {
      await createNotification(
        env,
        songOwnerId,
        userId,
        "react",
        "song",
        songId,
        `song:${songId}:react`,
        buildReactionMessage(finalType)
      );
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS reactions_count
       FROM song_reactions
       WHERE song_id = ?`
    ).bind(songId).first();

    const { results: breakdown } = await env.DB.prepare(
      `SELECT type, COUNT(*) AS count
       FROM song_reactions
       WHERE song_id = ?
       GROUP BY type
       ORDER BY count DESC, type ASC`
    ).bind(songId).all();

    return json({
      success: true,
      reacted,
      song_id: songId,
      user_id: userId,
      type: finalType,
      reactions_count: toNum((countRow as any)?.reactions_count, 0),
      reactions_breakdown: Array.isArray(breakdown) ? breakdown : [],
    });

  } catch (err: any) {
    return json(
      { success: false, error: err?.message || "Failed to react to song" },
      500
    );
  }
};
