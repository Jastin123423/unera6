
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const brandRoutes = new Hono<AppContext['env']>();

// Zod schema for validating the brand creation payload
const createBrandSchema = z.object({
  name: z.string().min(1, 'Brand name cannot be empty.'),
  description: z.string().optional(),
  logo_url: z.string().url('Invalid logo URL.').optional(),
  category: z.string().min(1, 'Category cannot be empty.'),
});

/**
 * POST /brands
 * Creates a new brand/page. Protected route.
 */
brandRoutes.post('/', authMiddleware, zValidator('json', createBrandSchema), async (c) => {
    const { name, description, logo_url, category } = c.req.valid('json');
    const ownerId = c.get('userId'); // Set by authMiddleware
    
    try {
        const { meta } = await c.env.DB.prepare(
            'INSERT INTO brands (owner_id, name, description, logo_url, category) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(ownerId, name, description, logo_url, category)
        .run();

        if (!meta.last_row_id) {
            return c.json({ error: 'Failed to create brand.' }, 500);
        }

        const newBrand = await c.env.DB.prepare('SELECT * FROM brands WHERE id = ?').bind(meta.last_row_id).first();
        return c.json({ message: 'Brand created successfully.', brand: newBrand }, 201);
    } catch (e: any) {
        console.error("Create Brand DB Error:", e.message);
        return c.json({ error: 'An error occurred while creating the brand.' }, 500);
    }
});

/**
 * GET /brands
 * Fetches all brands. Public route.
 */
brandRoutes.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT id, name, description, logo_url, category FROM brands ORDER BY created_at DESC').all();
        return c.json(results);
    } catch (e: any) {
        console.error("Fetch Brands DB Error:", e.message);
        return c.json({ error: 'Failed to fetch brands.' }, 500);
    }
});

export default brandRoutes;
