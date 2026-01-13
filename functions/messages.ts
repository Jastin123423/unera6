
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const messageRoutes = new Hono<AppContext['env']>();

const createMessageSchema = z.object({
  recipient_id: z.number().int(),
  text_content: z.string().min(1),
});

// GET /api/messages/conversations - Get all conversations for the current user
messageRoutes.get('/conversations', authMiddleware, async (c) => {
    const userId = c.get('userId');
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT c.id, c.type, c.last_message_at,
                (SELECT u.id FROM users u JOIN conversation_participants cp_other ON u.id = cp_other.user_id WHERE cp_other.conversation_id = c.id AND cp_other.user_id != ?) as recipient_id,
                (SELECT u.username FROM users u JOIN conversation_participants cp_other ON u.id = cp_other.user_id WHERE cp_other.conversation_id = c.id AND cp_other.user_id != ?) as recipient_name,
                (SELECT u.profile_image_url FROM users u JOIN conversation_participants cp_other ON u.id = cp_other.user_id WHERE cp_other.conversation_id = c.id AND cp_other.user_id != ?) as recipient_image
             FROM conversations c
             JOIN conversation_participants cp ON c.id = cp.conversation_id
             WHERE cp.user_id = ?
             ORDER BY c.last_message_at DESC`
        ).bind(userId, userId, userId, userId).all();
        return c.json(results);
    } catch (e: any) {
        console.error("Fetch Conversations DB Error:", e.message);
        return c.json({ error: 'Failed to fetch conversations.' }, 500);
    }
});

// GET /api/messages/conversations/:id - Get messages for a specific conversation
messageRoutes.get('/conversations/:id', authMiddleware, async (c) => {
    const userId = c.get('userId');
    const conversationId = parseInt(c.req.param('id'), 10);
    if (isNaN(conversationId)) return c.json({ error: 'Invalid conversation ID' }, 400);

    // Security check: ensure user is part of this conversation
    const isParticipant = await c.env.DB.prepare(
        'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
    ).bind(conversationId, userId).first();
    if (!isParticipant) return c.json({ error: 'Forbidden' }, 403);

    const { results } = await c.env.DB.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').bind(conversationId).all();
    return c.json(results);
});


// POST /api/messages/send - Send a new message
messageRoutes.post('/send', authMiddleware, zValidator('json', createMessageSchema), async (c) => {
    const senderId = c.get('userId');
    const { recipient_id, text_content } = c.req.valid('json');

    if (senderId === recipient_id) return c.json({ error: 'Cannot send message to yourself' }, 400);

    try {
        // Find existing one-on-one conversation
        const conversation: { id: number } | null = await c.env.DB.prepare(
            `SELECT cp1.conversation_id as id
             FROM conversation_participants cp1
             JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
             JOIN conversations c ON c.id = cp1.conversation_id
             WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.type = 'one_on_one'`
        ).bind(senderId, recipient_id).first();

        let conversationId = conversation?.id;

        // If no conversation exists, create one
        if (!conversationId) {
            const { meta: convMeta } = await c.env.DB.prepare("INSERT INTO conversations (type) VALUES ('one_on_one')").run();
            conversationId = convMeta.last_row_id;
            if (!conversationId) throw new Error('Failed to create conversation');
            
            await c.env.DB.prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)')
                .bind(conversationId, senderId, conversationId, recipient_id).run();
        }

        // Insert the message
        const now = new Date().toISOString();
        const { meta: msgMeta } = await c.env.DB.prepare(
            'INSERT INTO messages (conversation_id, sender_id, text_content, created_at) VALUES (?, ?, ?, ?)'
        ).bind(conversationId, senderId, text_content, now).run();

        // Update the conversation's last_message_at timestamp
        await c.env.DB.prepare('UPDATE conversations SET last_message_at = ? WHERE id = ?').bind(now, conversationId).run();

        const newMessage = await c.env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(msgMeta.last_row_id).first();
        return c.json(newMessage, 201);

    } catch (e: any) {
        console.error("Send Message DB Error:", e.message);
        return c.json({ error: 'Failed to send message.' }, 500);
    }
});

export default messageRoutes;
