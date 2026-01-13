
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const podcastRoutes = new Hono<AppContext['env']>();

const createEpisodeSchema = z.object({
  title: z.string().min(1),
  host: z.string().optional(),
  audio_url: z.string().url().optional(),
  thumbnail: z.string().url().optional(),
});

const commentSchema = z.object({
  text: z.string().min(1),
});

// GET /api/podcasts - Fetch all episodes
podcastRoutes.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM podcasts ORDER BY created_at DESC`
        ).all();
        return c.json(results);
    } catch (e: any) {
        return c.json({ error: 'Failed to fetch podcasts' }, 500);
    }
});

// POST /api/podcasts - Create entry
podcastRoutes.post('/', authMiddleware, zValidator('json', createEpisodeSchema), async (c) => {
    const creatorId = c.get('userId');
    const data = c.req.valid('json');
    try {
        const { meta } = await c.env.DB.prepare(
            'INSERT INTO podcasts (creator_id, title, host, thumbnail, audio_url) VALUES (?, ?, ?, ?, ?)'
        ).bind(creatorId, data.title, data.host || 'Unknown Host', data.thumbnail || null, data.audio_url || null).run();

        const newEpisode = await c.env.DB.prepare('SELECT * FROM podcasts WHERE id = ?').bind(meta.last_row_id).first();
        return c.json(newEpisode, 201);
    } catch (e: any) {
        return c.json({ error: 'Failed' }, 500);
    }
});

// Like/Comment/Play routes for podcasts...
podcastRoutes.post('/:id/like', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    return c.json({ success: true, message: 'Logged' });
});

podcastRoutes.post('/:id/comment', authMiddleware, zValidator('json', commentSchema), async (c) => {
    return c.json({ success: true });
});

podcastRoutes.post('/:id/play', async (c) => {
    const id = c.req.param('id');
    try {
        await c.env.DB.prepare('UPDATE podcasts SET plays = plays + 1 WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: 'Failed' }, 500);
    }
});

export default podcastRoutes;
