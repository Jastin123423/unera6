export async function onRequestPost(context: any) {
  const { request, env } = context;

  const body = await request.json().catch(() => ({}));

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const password = String(body.password ?? "");

  if (!email || !password) {
    return Response.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  const user = await env.DB
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first();

  if (!user) {
    return Response.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(password));
  const incomingHash = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  if (incomingHash !== (user as any).password_hash) {
    return Response.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  delete (user as any).password_hash;

  return Response.json({ success: true, user });
}
