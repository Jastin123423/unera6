// @google/genai-api-fix: Removed reference to '@cloudflare/workers-types' which was causing a 'Cannot find type definition file' error. The placeholder types below are used instead.

// @google/genai-api-fix: Define minimal placeholder types for Cloudflare Bindings to resolve static analysis errors when the full `@cloudflare/workers-types` are not available.
// @google/genai-api-fix: Exporting these types so they can be imported into auth_utils.ts.
export interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run<T = unknown>(): Promise<{ meta: any; success: boolean }>;
    all<T = unknown>(): Promise<{ results: T[] }>;
}
export interface D1Database {
    prepare(query: string): D1PreparedStatement;
}
type R2Bucket = any;

import { Context } from 'hono';

// Define the structure for the Cloudflare environment bindings
// These are configured in your Cloudflare dashboard or wrangler.toml
export type Env = {
  Bindings: {
    DB: D1Database; // D1 Database binding
    R2: R2Bucket;   // R2 Bucket binding
    JWT_SECRET: string; // Secret for signing JWTs
  };
  Variables: {
    userId: number; // This will be set by the authentication middleware
  };
};

// Custom Hono context type for end-to-end type safety
export type AppContext = Context<Env>;