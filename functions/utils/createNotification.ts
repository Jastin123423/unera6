export async function createNotification(
  env: any,
  recipient_id: number,
  actor_id: number,
  type: string,
  entity_type: string,
  entity_id: number,
  group_key: string
) {

  if (recipient_id === actor_id) return;

  const existing = await env.DB.prepare(`
    SELECT id, actors_count
    FROM notifications
    WHERE recipient_id = ?
    AND group_key = ?
    AND created_at > datetime('now','-24 hours')
    LIMIT 1
  `)
    .bind(recipient_id, group_key)
    .first();

  if (existing) {

    await env.DB.prepare(`
      UPDATE notifications
      SET actors_count = actors_count + 1,
          created_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(existing.id)
      .run();

  } else {

    await env.DB.prepare(`
      INSERT INTO notifications
      (recipient_id, actor_id, type, entity_type, entity_id, group_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .bind(
        recipient_id,
        actor_id,
        type,
        entity_type,
        entity_id,
        group_key
      )
      .run();
  }
}
