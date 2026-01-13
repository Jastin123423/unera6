
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const storyRoutes = new Hono<AppContext['env']>();

// Zod schema to validate story creation, handling different types
const createStorySchema = z.object({
    type: z.enum(['text', 'image']),
    text_content: z.string().optional(),
    background_style: z.string().optional(),
    media_url: z.string().url().optional(),
    music_url: z.string().url().optional(),
    music_title: z.string().optional(),
}).refine(data => {
    if (data.type === 'text') return !!data.text_content;
    if (data.type === 'image') return !!data.media_url;
    return false;
}, {
    message: "Text stories require 'text_content', and image stories require 'media_url'.",
});

/**
 * POST /stories
 * Creates a new story. Protected route.
 */
storyRoutes.post('/', authMiddleware, zValidator('json', createStorySchema), async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    
    // Stories expire 24 hours after creation
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
        const { meta } = await c.env.DB.prepare(
            `INSERT INTO stories (user_id, type, text_content, background_style, media_url, music_url, music_title, expires_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
            userId,
            body.type,
            body.text_content,
            body.background_style,
            body.media_url,
            body.music_url,
            body.music_title,
            expires_at
        )
        .run();

        if (!meta.last_row_id) {
            return c.json({ error: 'Failed to create story.' }, 500);
        }

        const newStory = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(meta.last_row_id).first();
        return c.json({ message: 'Story created successfully.', story: newStory }, 201);
    } catch (e: any) {
        console.error("Create Story DB Error:", e.message);
        return c.json({ error: 'An error occurred while creating the story.' }, 500);
    }
});

/**
 * GET /stories
 * Fetches all active (non-expired) stories. Public route.
 */
storyRoutes.get('/', async (c) => {
    const now = new Date().toISOString();
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT s.*, u.username as author_name, u.profile_image_url as author_image
             FROM stories s
             JOIN users u ON s.user_id = u.id
             WHERE s.expires_at > ?
             ORDER BY s.created_at DESC`
        ).bind(now).all();
        
        return c.json(results);
    } catch (e: any) {
        console.error("Fetch Stories DB Error:", e.message);
        return c.json({ error: 'Failed to fetch stories.' }, 500);
    }
});

export default storyRoutes;
