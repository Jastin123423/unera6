
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const songRoutes = new Hono<AppContext['env']>();

const createSongSchema = z.object({
  title: z.string().min(1),
  artist_name: z.string().optional(),
  audio_url: z.string().url().optional(),
  cover_image_url: z.string().url().optional(),
});

const commentSchema = z.object({
  text: z.string().min(1),
});

// GET /api/songs - Fetch all songs
songRoutes.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT s.*, u.username as uploader_name
             FROM songs s
             JOIN users u ON s.uploader_id = u.id
             ORDER BY s.created_at DESC`
        ).all();
        return c.json(results);
    } catch (e: any) {
        return c.json({ error: 'Failed to fetch songs' }, 500);
    }
});

// POST /api/songs - Upload metadata (usually part of a larger file upload flow)
songRoutes.post('/', authMiddleware, zValidator('json', createSongSchema), async (c) => {
    const uploaderId = c.get('userId');
    const songData = c.req.valid('json');
    try {
        const { meta } = await c.env.DB.prepare(
            'INSERT INTO songs (uploader_id, title, artist_name, cover_image_url, audio_url) VALUES (?, ?, ?, ?, ?)'
        ).bind(uploaderId, songData.title, songData.artist_name || 'Various Artists', songData.cover_image_url || null, songData.audio_url || null).run();

        const newSong = await c.env.DB.prepare('SELECT * FROM songs WHERE id = ?').bind(meta.last_row_id).first();
        return c.json(newSong, 201);
    } catch (e: any) {
        return c.json({ error: 'Failed to upload song metadata' }, 500);
    }
});

// POST /api/songs/:id/like - Like or unlike a song
songRoutes.post('/:id/like', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const songId = parseInt(c.req.param('id'), 10);
    if (isNaN(songId)) return c.json({ error: 'Invalid song ID' }, 400);

    const existingLike: { id: number } | null = await c.env.DB.prepare('SELECT id FROM song_likes WHERE user_id = ? AND song_id = ?').bind(userId, songId).first();
    if (existingLike) {
        await c.env.DB.prepare('DELETE FROM song_likes WHERE id = ?').bind(existingLike.id).run();
        return c.json({ success: true, message: 'Unliked' });
    } else {
        await c.env.DB.prepare('INSERT INTO song_likes (user_id, song_id) VALUES (?, ?)').bind(userId, songId).run();
        return c.json({ success: true, message: 'Liked' });
    }
});

// POST /api/songs/:id/comment - Add a comment to a song
songRoutes.post('/:id/comment', authMiddleware, zValidator('json', commentSchema), async (c) => {
    const userId = c.get('userId');
    const songId = parseInt(c.req.param('id'), 10);
    const { text } = c.req.valid('json');
    if (isNaN(songId)) return c.json({ error: 'Invalid song ID' }, 400);

    const { meta } = await c.env.DB.prepare('INSERT INTO song_comments (user_id, song_id, text) VALUES (?, ?, ?)').bind(userId, songId, text).run();
    const newComment = await c.env.DB.prepare('SELECT * FROM song_comments WHERE id = ?').bind(meta.last_row_id).first();
    return c.json({ success: true, data: newComment }, 201);
});

// POST /api/songs/:id/play - Increment play count
songRoutes.post('/:id/play', async (c) => {
    const songId = parseInt(c.req.param('id'), 10);
    if (isNaN(songId)) return c.json({ error: 'Invalid song ID' }, 400);
    try {
        await c.env.DB.prepare('UPDATE songs SET plays = plays + 1 WHERE id = ?').bind(songId).run();
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: 'Failed' }, 500);
    }
});

export default songRoutes;
