
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const groupRoutes = new Hono<AppContext['env']>();

const createGroupSchema = z.object({
  name: z.string().min(3, 'Group name must be at least 3 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  type: z.enum(['public', 'private']),
  cover_image: z.string().url().optional(),
  profile_image: z.string().url().optional(),
});

const createGroupPostSchema = z.object({
  content: z.string().min(1),
  media_url: z.string().url().optional(),
});

// Create a new group
groupRoutes.post('/', authMiddleware, zValidator('json', createGroupSchema), async (c) => {
    const adminId = c.get('userId');
    const { name, description, type, cover_image, profile_image } = c.req.valid('json');
    
    try {
        // Create the group
        const { meta: groupMeta } = await c.env.DB.prepare(
            'INSERT INTO groups (admin_id, name, description, type, cover_image, profile_image) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
            adminId, 
            name, 
            description, 
            type, 
            cover_image || `https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1500&q=80`,
            profile_image || `https://ui-avatars.com/api/?name=${name.replace(/\s/g, '+')}&background=random`
        ).run();

        const groupId = groupMeta.last_row_id;
        if (!groupId) {
            return c.json({ error: 'Failed to create group.' }, 500);
        }

        // Automatically add the creator as the first member
        await c.env.DB.prepare(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)'
        ).bind(groupId, adminId, 'admin').run();

        const newGroup = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(groupId).first();
        return c.json({ message: 'Group created successfully.', group: newGroup }, 201);
    } catch (e: any) {
        console.error("Create Group DB Error:", e.message);
        return c.json({ error: 'An error occurred while creating the group.' }, 500);
    }
});

// List all public groups
groupRoutes.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count 
             FROM groups g 
             WHERE g.type = 'public' 
             ORDER BY created_at DESC`
        ).all();
        return c.json(results);
    } catch (e: any) {
        console.error("Fetch Groups DB Error:", e.message);
        return c.json({ error: 'Failed to fetch groups.' }, 500);
    }
});

// Join or leave a group
groupRoutes.post('/:id/join', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const groupId = parseInt(c.req.param('id'), 10);

    if (isNaN(groupId)) return c.json({ error: 'Invalid group ID.' }, 400);

    try {
        const existingMembership: { id: number } | null = await c.env.DB.prepare(
            'SELECT id FROM group_members WHERE user_id = ? AND group_id = ?'
        ).bind(userId, groupId).first();

        if (existingMembership) {
            // Leave group
            await c.env.DB.prepare('DELETE FROM group_members WHERE id = ?').bind(existingMembership.id).run();
            return c.json({ message: 'Left group successfully.' });
        } else {
            // Join group (only public for now)
            const group: {type: string} | null = await c.env.DB.prepare('SELECT type FROM groups WHERE id = ?').bind(groupId).first();
            if (group?.type !== 'public') {
                return c.json({ error: 'Cannot join a private group without an invite.' }, 403);
            }
            await c.env.DB.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)')
                .bind(groupId, userId, 'member').run();
            return c.json({ message: 'Joined group successfully.' });
        }
    } catch (e: any) {
        console.error("Join/Leave Group DB Error:", e.message);
        return c.json({ error: 'An error occurred.' }, 500);
    }
});

// Get posts within a group
groupRoutes.get('/:id/posts', async (c) => {
    const groupId = parseInt(c.req.param('id'), 10);
    if (isNaN(groupId)) return c.json({ error: 'Invalid group ID.' }, 400);
    
    // In a real app, you would check if the group is private and if the user is a member
    const { results } = await c.env.DB.prepare(
        `SELECT gp.*, u.username as author_name, u.profile_image_url as author_image
         FROM group_posts gp
         JOIN users u ON gp.user_id = u.id
         WHERE gp.group_id = ?
         ORDER BY gp.created_at DESC`
    ).bind(groupId).all();
    return c.json(results);
});

// Create a post in a group
groupRoutes.post('/:id/posts', authMiddleware, zValidator('json', createGroupPostSchema), async (c) => {
    const userId = c.get('userId');
    const groupId = parseInt(c.req.param('id'), 10);
    const { content, media_url } = c.req.valid('json');

    if (isNaN(groupId)) return c.json({ error: 'Invalid group ID.' }, 400);

    // Verify user is a member of the group
    const isMember = await c.env.DB.prepare(
        'SELECT id FROM group_members WHERE user_id = ? AND group_id = ?'
    ).bind(userId, groupId).first();

    if (!isMember) {
        return c.json({ error: 'You must be a member to post in this group.' }, 403);
    }

    const { meta } = await c.env.DB.prepare(
        'INSERT INTO group_posts (group_id, user_id, content, media_url) VALUES (?, ?, ?, ?)'
    ).bind(groupId, userId, content, media_url).run();

    if (!meta.last_row_id) {
        return c.json({ error: 'Failed to create post.' }, 500);
    }
    
    return c.json({ message: 'Post created successfully.' }, 201);
});

export default groupRoutes;
