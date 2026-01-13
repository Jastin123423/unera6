
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const reelRoutes = new Hono<AppContext['env']>();

// Zod schema for validating reel creation
const createReelSchema = z.object({
    video_url: z.string().url('A valid video URL is required.'),
    caption: z.string().optional(),
    song_name: z.string().optional(),
});

// Zod schema for comments
const commentSchema = z.object({
    text: z.string().min(1, "Comment text cannot be empty.")
});

/**
 * POST /reels
 * Creates a new reel. Protected route.
 */
reelRoutes.post('/', authMiddleware, zValidator('json', createReelSchema), async (c) => {
    const userId = c.get('userId');
    const { video_url, caption, song_name } = c.req.valid('json');

    try {
        const { meta } = await c.env.DB.prepare(
            'INSERT INTO reels (user_id, video_url, caption, song_name) VALUES (?, ?, ?, ?)'
        ).bind(userId, video_url, caption, song_name).run();

        if (!meta.last_row_id) {
            return c.json({ error: 'Failed to create reel.' }, 500);
        }

        const newReel = await c.env.DB.prepare('SELECT * FROM reels WHERE id = ?').bind(meta.last_row_id).first();
        return c.json({ message: 'Reel created successfully.', reel: newReel }, 201);
    } catch (e: any) {
        console.error("Create Reel DB Error:", e.message);
        return c.json({ error: 'An error occurred while creating the reel.' }, 500);
    }
});

/**
 * GET /reels
 * Fetches all reels with author info and interaction counts. Public route.
 */
reelRoutes.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT 
                r.*, 
                u.username as author_name, 
                u.profile_image_url as author_image,
                (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.id) as likes_count,
                (SELECT COUNT(*) FROM reel_comments rc WHERE rc.reel_id = r.id) as comments_count
             FROM reels r
             JOIN users u ON r.user_id = u.id
             ORDER BY r.created_at DESC`
        ).all();
        return c.json(results);
    } catch (e: any) {
        console.error("Fetch Reels DB Error:", e.message);
        return c.json({ error: 'Failed to fetch reels.' }, 500);
    }
});

/**
 * POST /reels/:id/like
 * Likes or unlikes a reel. Protected route.
 */
reelRoutes.post('/:id/like', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const reelId = parseInt(c.req.param('id'), 10);

    if (isNaN(reelId)) {
        return c.json({ error: 'Invalid reel ID.' }, 400);
    }

    try {
        // Check if the user already liked this reel
        const existingLike: { id: number } | null = await c.env.DB.prepare(
            'SELECT id FROM reel_likes WHERE user_id = ? AND reel_id = ?'
        ).bind(userId, reelId).first();

        if (existingLike) {
            // Unlike the reel
            await c.env.DB.prepare('DELETE FROM reel_likes WHERE id = ?').bind(existingLike.id).run();
            return c.json({ message: 'Reel unliked successfully.' });
        } else {
            // Like the reel
            await c.env.DB.prepare('INSERT INTO reel_likes (user_id, reel_id) VALUES (?, ?)')
            .bind(userId, reelId).run();
            return c.json({ message: 'Reel liked successfully.' });
        }
    } catch (e: any) {
        console.error("Like Reel DB Error:", e.message);
        return c.json({ error: 'An error occurred while liking the reel.' }, 500);
    }
});


/**
 * POST /reels/:id/comment
 * Adds a comment to a reel. Protected route.
 */
reelRoutes.post('/:id/comment', authMiddleware, zValidator('json', commentSchema), async (c) => {
    const userId = c.get('userId');
    const reelId = parseInt(c.req.param('id'), 10);
    const { text } = c.req.valid('json');

    if (isNaN(reelId)) {
        return c.json({ error: 'Invalid reel ID.' }, 400);
    }
    
    try {
        const { meta } = await c.env.DB.prepare(
            'INSERT INTO reel_comments (user_id, reel_id, text) VALUES (?, ?, ?)'
        ).bind(userId, reelId, text).run();

        if (!meta.last_row_id) {
            return c.json({ error: 'Failed to add comment.' }, 500);
        }
        
        const newComment = await c.env.DB.prepare(
             `SELECT rc.*, u.username as author_name, u.profile_image_url as author_image
              FROM reel_comments rc
              JOIN users u ON rc.user_id = u.id
              WHERE rc.id = ?`
        ).bind(meta.last_row_id).first();

        return c.json({ message: 'Comment added successfully.', comment: newComment }, 201);
    } catch(e: any) {
        console.error("Comment Reel DB Error:", e.message);
        return c.json({ error: 'An error occurred while adding the comment.' }, 500);
    }
});

/**
 * GET /reels/:id/comments
 * Fetches comments for a specific reel.
 */
reelRoutes.get('/:id/comments', async (c) => {
    const reelId = parseInt(c.req.param('id'), 10);
    if (isNaN(reelId)) {
        return c.json({ error: 'Invalid reel ID' }, 400);
    }
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT rc.*, u.username as author_name, u.profile_image_url as author_image
             FROM reel_comments rc
             JOIN users u ON rc.user_id = u.id
             WHERE rc.reel_id = ?
             ORDER BY rc.created_at ASC`
        ).bind(reelId).all();
        return c.json(results);
    } catch (e: any) {
        return c.json({ error: 'Failed to fetch comments' }, 500);
    }
});


export default reelRoutes;
