
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const postRoutes = new Hono<AppContext['env']>();

// --- Zod Schemas for Validation ---
const createPostSchema = z.object({
    // user_id is taken from the JWT for security, not from the request body.
    content: z.string().min(1, 'Content cannot be empty.').optional(),
    media_url: z.string().url('Invalid media URL.').optional(),
}).refine(data => data.content || data.media_url, {
    message: "A post must have either content or a media URL.",
});

const commentSchema = z.object({
    text: z.string().min(1, "Comment cannot be empty.")
});

// --- API Routes ---

/**
 * GET /posts
 * Fetches all posts, joining with user data to include author info.
 * This is a public route.
 */
postRoutes.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT 
                p.id,
                p.user_id,
                p.content,
                p.media_url,
                p.created_at,
                u.username as author_name,
                u.profile_image_url as author_image
             FROM posts p 
             JOIN users u ON p.user_id = u.id 
             ORDER BY p.created_at DESC
             LIMIT 50` // Add pagination later
        ).all();
        
        return c.json(results);
    } catch (e: any) {
        console.error("Fetch Posts DB Error:", e.message);
        return c.json({ error: 'Failed to fetch posts.' }, 500);
    }
});

/**
 * POST /posts
 * Creates a new post. This is a protected route.
 */
postRoutes.post(
    '/',
    authMiddleware, // Apply authentication middleware first
    zValidator('json', createPostSchema),
    async (c) => {
        const { content, media_url } = c.req.valid('json');
        const userId = c.get('userId'); // Get user ID from the context (set by authMiddleware)

        try {
            // Insert the new post into the database
            const { meta } = await c.env.DB.prepare(
                'INSERT INTO posts (user_id, content, media_url) VALUES (?, ?, ?)'
            )
            .bind(userId, content || null, media_url || null)
            .run();

            if (!meta.last_row_id) {
                return c.json({ error: 'Failed to create the post.' }, 500);
            }
            
            // Fetch the newly created post to return it in the response
            const newPost = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(meta.last_row_id).first();

            return c.json(newPost, 201);

        } catch (e: any) {
            console.error("Create Post DB Error:", e.message);
            return c.json({ error: 'An error occurred while creating the post.' }, 500);
        }
    }
);

/**
 * POST /posts/:id/like
 * Likes or unlikes a post. Protected route.
 */
postRoutes.post('/:id/like', authMiddleware, async (c) => {
    const postId = parseInt(c.req.param('id'), 10);
    const userId = c.get('userId');

    if (isNaN(postId)) {
        return c.json({ error: 'Invalid post ID.' }, 400);
    }

    try {
        const existingLike: { id: number } | null = await c.env.DB.prepare(
            'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?'
        ).bind(userId, postId).first();

        if (existingLike) {
            await c.env.DB.prepare('DELETE FROM post_likes WHERE id = ?').bind(existingLike.id).run();
            return c.json({ message: 'Post unliked successfully.' });
        } else {
            await c.env.DB.prepare('INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)')
                .bind(userId, postId).run();
            return c.json({ message: 'Post liked successfully.' });
        }
    } catch (e: any) {
        console.error("Like Post DB Error:", e.message);
        return c.json({ error: 'An error occurred while processing the like.' }, 500);
    }
});

/**
 * POST /posts/:id/comment
 * Adds a comment to a post. Protected route.
 */
postRoutes.post('/:id/comment', authMiddleware, zValidator('json', commentSchema), async (c) => {
    const postId = parseInt(c.req.param('id'), 10);
    const userId = c.get('userId');
    const { text } = c.req.valid('json');

    if (isNaN(postId)) {
        return c.json({ error: 'Invalid post ID.' }, 400);
    }

    try {
        const { meta } = await c.env.DB.prepare(
            'INSERT INTO post_comments (user_id, post_id, text) VALUES (?, ?, ?)'
        ).bind(userId, postId, text).run();

        if (!meta.last_row_id) {
            return c.json({ error: 'Failed to add comment.' }, 500);
        }
        
        const newComment = await c.env.DB.prepare('SELECT * FROM post_comments WHERE id = ?').bind(meta.last_row_id).first();
        return c.json({ message: 'Comment added successfully.', comment: newComment }, 201);
    } catch (e: any) {
        console.error("Comment Post DB Error:", e.message);
        return c.json({ error: 'An error occurred while adding the comment.' }, 500);
    }
});

/**
 * GET /posts/:id/comments
 * Retrieves all comments for a specific post. Public route.
 */
postRoutes.get('/:id/comments', async (c) => {
    const postId = parseInt(c.req.param('id'), 10);
    if (isNaN(postId)) {
        return c.json({ error: 'Invalid post ID.' }, 400);
    }

    try {
        const { results } = await c.env.DB.prepare(
            `SELECT c.*, u.username as author_name, u.profile_image_url as author_image
             FROM post_comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.post_id = ?
             ORDER BY c.created_at ASC`
        ).bind(postId).all();

        return c.json(results);
    } catch (e: any) {
        console.error("Fetch Comments DB Error:", e.message);
        return c.json({ error: 'Failed to fetch comments.' }, 500);
    }
});

export default postRoutes;
