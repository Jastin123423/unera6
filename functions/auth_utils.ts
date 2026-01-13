import { jwtVerify } from 'jose';
// @google/genai-api-fix: Import D1Database from the shared types file.
import { D1Database } from './types';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

/**
 * Standard utility to verify the JWT token from the Authorization header.
 * Returns the userId if valid, or throws an error.
 */
export async function verifyUser(request: Request, secret: string): Promise<number> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.substring(7);
  const secretKey = new TextEncoder().encode(secret);

  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.id || typeof payload.id !== 'number') {
      throw new Error('Invalid Token');
    }
    return payload.id;
  } catch (err) {
    throw new Error('Invalid Token');
  }
}

/**
 * Utility for password hashing using Web Crypto
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Standard CORS Response Headers
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};