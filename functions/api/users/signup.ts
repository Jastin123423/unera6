export async function onRequestPost(context: any) {
  const { request, env } = context;

  const body = await request.json().catch(() => ({}));

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const username = String(body.username ?? "")
    .trim()
    .replace(/\s+/g, " ");

  const password = String(body.password ?? "");

  if (!username || !email || !password) {
    return Response.json(
      { error: "username, email and password are required" },
      { status: 400 }
    );
  }

  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  const password_hash = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const result = await env.DB
    .prepare(`
      INSERT INTO users (username, email, password_hash, joined_date, created_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `)
    .bind(username, email, password_hash)
    .run();

  return Response.json(
    { success: true, user_id: result.meta.last_row_id },
    { status: 201 }
  );
}
