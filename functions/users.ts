
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sign } from 'hono/jwt';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const userRoutes = new Hono<AppContext['env']>();

// --- Helper Functions ---
// Securely hashes a password using the Web Crypto API (available in Cloudflare Workers)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Convert buffer to hex string
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Zod Schemas for Validation ---
const signupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters long.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// --- API Routes ---

/**
 * GET /users
 * Fetches all users.
 */
userRoutes.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare('SELECT id, username, profile_image_url, bio, location, is_verified, role FROM users').all();
        return c.json(results);
    } catch (e: any) {
        return c.json({ error: 'Failed to fetch users.' }, 500);
    }
});

/**
 * GET /users/me
 * Fetches the profile of the currently authenticated user.
 */
userRoutes.get('/me', authMiddleware, async (c) => {
    const userId = c.get('userId');
    try {
        const user = await c.env.DB.prepare('SELECT id, username, email, profile_image_url, cover_image_url, bio, work, education, location, website, is_verified, role, created_at FROM users WHERE id = ?')
            .bind(userId)
            .first();
        
        if (!user) {
            return c.json({ error: 'User not found.' }, 404);
        }
        return c.json(user);
    } catch (e: any) {
        return c.json({ error: 'Failed to fetch user profile.' }, 500);
    }
});

/**
 * POST /users/signup
 * Creates a new user account.
 */
userRoutes.post(
  '/signup',
  zValidator('json', signupSchema),
  async (c) => {
    const { username, email, password } = c.req.valid('json');
    const db = c.env.DB;

    // 1. Check if a user with the same email or username already exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ? OR username = ?')
        .bind(email, username)
        .first();

    if (existingUser) {
        return c.json({ error: 'A user with this email or username already exists.' }, 409);
    }
    
    // 2. Hash the password for secure storage
    const password_hash = await hashPassword(password);

    try {
        // 3. Insert the new user into the database
        const { meta } = await db.prepare('INSERT INTO users (username, email, password_hash, profile_image_url) VALUES (?, ?, ?, ?)')
            .bind(username, email, password_hash, `https://ui-avatars.com/api/?name=${username.replace(/\s/g, '+')}&background=random`)
            .run();
        
        const newUserId = meta.last_row_id;
        if (!newUserId) {
            return c.json({ error: 'Failed to create user account.' }, 500);
        }
        
        const newUser = await db.prepare('SELECT id, username, email, profile_image_url FROM users WHERE id = ?').bind(newUserId).first();

        // 4. Sign a JWT for the new user to log them in immediately
        const token = await sign({ id: newUserId, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, c.env.JWT_SECRET);

        return c.json({ message: 'User created successfully.', token, user: newUser }, 201);
    } catch (e: any) {
        console.error("Signup DB Error:", e.message);
        return c.json({ error: 'An error occurred while creating the account.' }, 500);
    }
  }
);

/**
 * POST /users/login
 * Authenticates a user and returns a JWT and user profile.
 */
userRoutes.post(
    '/login',
    zValidator('json', loginSchema),
    async (c) => {
        const { email, password } = c.req.valid('json');
        const db = c.env.DB;

        const user: any = await db.prepare('SELECT * FROM users WHERE email = ?')
            .bind(email)
            .first();

        if (!user) {
            return c.json({ error: 'Invalid email or password.' }, 401);
        }

        const request_password_hash = await hashPassword(password);
        if (request_password_hash !== user.password_hash) {
            return c.json({ error: 'Invalid email or password.' }, 401);
        }

        const token = await sign({ id: user.id, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, c.env.JWT_SECRET);
        
        // Don't send the password hash to the client
        delete user.password_hash;

        return c.json({ message: 'Login successful.', token, user });
    }
);


/**
 * POST /users/:id/follow
 * Follows or unfollows a user. Protected route.
 */
userRoutes.post('/:id/follow', authMiddleware, async (c) => {
    const userIdToFollow = parseInt(c.req.param('id'), 10);
    const currentUserId = c.get('userId');

    if (isNaN(userIdToFollow) || userIdToFollow === currentUserId) {
        return c.json({ error: 'Invalid user ID or cannot follow yourself.' }, 400);
    }

    try {
        const existingFollow: { id: number } | null = await c.env.DB.prepare(
            'SELECT id FROM followers WHERE follower_id = ? AND following_id = ?'
        ).bind(currentUserId, userIdToFollow).first();

        if (existingFollow) {
            // Unfollow
            await c.env.DB.prepare('DELETE FROM followers WHERE id = ?').bind(existingFollow.id).run();
            return c.json({ message: 'Unfollowed successfully.' });
        } else {
            // Follow
            await c.env.DB.prepare('INSERT INTO followers (follower_id, following_id) VALUES (?, ?)')
                .bind(currentUserId, userIdToFollow)
                .run();
            return c.json({ message: 'Followed successfully.' });
        }
    } catch (e: any) {
        console.error("Follow/Unfollow DB Error:", e.message);
        return c.json({ error: 'An error occurred.' }, 500);
    }
});

export default userRoutes;
