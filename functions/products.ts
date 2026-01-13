
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppContext } from './types';
import { authMiddleware } from './auth';

const productRoutes = new Hono<AppContext['env']>();

// Zod schema for validating product creation
const createProductSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  category: z.string().min(1, 'Category is required.'),
  description: z.string().min(1, 'Description is required.'),
  country: z.string().min(1, 'Country code is required.'),
  address: z.string().min(1, 'Address is required.'),
  mainPrice: z.number().positive('Price must be positive.'),
  discountPrice: z.number().positive().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be at least 1.'),
  phoneNumber: z.string().min(1, 'Phone number is required.'),
  images: z.array(z.string().url('Each image must be a valid URL.')).min(1, 'At least one image is required.'),
});

/**
 * POST /products
 * Creates a new product listing. Protected route.
 */
productRoutes.post('/', authMiddleware, zValidator('json', createProductSchema), async (c) => {
    const sellerId = c.get('userId');
    const productData = c.req.valid('json');

    try {
        const { meta } = await c.env.DB.prepare(
            `INSERT INTO products (seller_id, title, category, description, country, address, main_price, discount_price, quantity, phone_number, images) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            sellerId,
            productData.title,
            productData.category,
            productData.description,
            productData.country,
            productData.address,
            productData.mainPrice,
            productData.discountPrice,
            productData.quantity,
            productData.phoneNumber,
            JSON.stringify(productData.images) // Store images as a JSON string array
        ).run();

        if (!meta.last_row_id) {
            return c.json({ error: 'Failed to create product listing.' }, 500);
        }

        const newProduct = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(meta.last_row_id).first();
        return c.json({ message: 'Product listed successfully.', product: newProduct }, 201);
    } catch (e: any) {
        console.error("Create Product DB Error:", e.message);
        return c.json({ error: 'An error occurred while listing the product.' }, 500);
    }
});

/**
 * GET /products
 * Fetches all product listings. Public route.
 */
productRoutes.get('/', async (c) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT p.*, u.username as seller_name, u.profile_image_url as seller_avatar
             FROM products p
             JOIN users u ON p.seller_id = u.id
             ORDER BY p.created_at DESC`
        ).all();

        // Parse the images JSON string back into an array
        const productsWithImages = results.map((p: any) => ({
            ...p,
            images: JSON.parse(p.images || '[]'),
        }));
        
        return c.json(productsWithImages);
    } catch (e: any) {
        console.error("Fetch Products DB Error:", e.message);
        return c.json({ error: 'Failed to fetch products.' }, 500);
    }
});

export default productRoutes;
