
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import { AppContext } from './types';

// Middleware to protect routes that require a logged-in user
export const authMiddleware = createMiddleware<AppContext['env']>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  // Check for the Authorization header and 'Bearer ' prefix
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or malformed token' }, 401);
  }

  const token = authHeader.substring(7); // Remove 'Bearer '
  const secret = c.env.JWT_SECRET;

  if (!secret) {
    console.error("JWT_SECRET is not configured in environment bindings.");
    return c.json({ error: 'Internal Server Error: JWT secret not configured' }, 500);
  }

  try {
    // Verify the token and its signature
    const decodedPayload = await verify(token, secret);
    
    // Ensure the payload has the required user ID
    if (!decodedPayload.id || typeof decodedPayload.id !== 'number') {
        return c.json({ error: 'Unauthorized: Invalid token payload' }, 401);
    }

    // Add the user ID to the context for downstream handlers
    c.set('userId', decodedPayload.id);

  } catch (err) {
    // Catches expired tokens, invalid signatures, etc.
    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
  }

  // Proceed to the next middleware or the route handler
  await next();
});
