// functions/api/upload.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  R2: R2Bucket;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const guessExt = (contentType: string) => {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('jpeg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('mp4')) return 'mp4';
  if (ct.includes('quicktime')) return 'mov';
  if (ct.includes('webm')) return 'webm';
  return 'bin';
};

const safeName = (s: string) =>
  s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.R2) return json({ error: 'R2 binding missing (R2)' }, 500);

    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) {
      return json({ error: 'Use multipart/form-data with field name "file"' }, 400);
    }

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return json({ error: 'Missing file. Send as multipart field "file".' }, 400);
    }

    // Basic limits (adjust as you like)
    const maxBytes = 50 * 1024 * 1024; // 50MB (ok for reels)
    if (file.size > maxBytes) return json({ error: 'File too large (max 50MB)' }, 413);

    const contentType = file.type || 'application/octet-stream';
    const ext = guessExt(contentType);

    const folder =
      contentType.startsWith('image/')
        ? 'images'
        : contentType.startsWith('video/')
        ? 'videos'
        : 'files';

    const original = safeName(file.name || `upload.${ext}`);
    const key = `${folder}/${Date.now()}-${crypto.randomUUID()}-${original}`;

    // Upload
    await env.R2.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType },
      customMetadata: { originalName: original },
    });

    // ✅ IMPORTANT:
    // Put your custom domain here if you set it: https://media.unera.social
    // If you didn’t set a domain yet, tell me what public URL Cloudflare shows and we’ll use it.
    const PUBLIC_BASE = 'https://media.unera.social';

    const url = `${PUBLIC_BASE}/${key}`;

    return json({ success: true, key, url, contentType, size: file.size });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
