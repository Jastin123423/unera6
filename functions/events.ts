
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const eventRoutes = new Hono<AppContext['env']>();

// Zod schema for validating the event creation payload
const createEventSchema = z.object({
  title: z.string().min(1, 'Event title cannot be empty.'),
  description: z.string().optional(),
  event_date: z.string().datetime({ message: "Invalid datetime format. Please use ISO 8601 format." }),
  location: z.string().min(1, 'Location is required.'),
  cover_url: z.string().url('Invalid cover URL.').optional(),
});

/**
 * POST /events
 * Creates a new event. Protected route.
 */
eventRoutes.post('/', authMiddleware, zValidator('json', createEventSchema), async (c) => {
    const { title, description, event_date, location, cover_url } = c.req.valid('json');
    const creatorId = c.get('userId');

    try {
        const { meta } = await c.env.DB.prepare(
            'INSERT INTO events (creator_id, title, description, event_date, location, cover_url) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(creatorId, title, description, event_date, location, cover_url)
        .run();

        if (!meta.last_row_id) {
            return c.json({ error: 'Failed to create event.' }, 500);
        }

        const newEvent = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(meta.last_row_id).first();
        return c.json({ message: 'Event created successfully.', event: newEvent }, 201);
    } catch (e: any) {
        console.error("Create Event DB Error:", e.message);
        return c.json({ error: 'An error occurred while creating the event.' }, 500);
    }
});

/**
 * GET /events
 * Fetches all events, ordered by date. Public route.
 */
eventRoutes.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT * FROM events ORDER BY event_date ASC').all();
        return c.json(results);
    } catch (e: any) {
        console.error("Fetch Events DB Error:", e.message);
        return c.json({ error: 'Failed to fetch events.' }, 500);
    }
});

export default eventRoutes;
