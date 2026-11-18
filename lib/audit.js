// Call only with the business transaction's connection. Never acquire another connection here.
export async function recordAudit(
  connection,
  {
    entityType,
    entityId,
    billId = null,
    action,
    actorUserId = null,
    actorSource = 'user',
    before = null,
    after = null,
    reason = null,
  },
) {
  await connection.execute(
    `INSERT INTO audit_log
      (entity_type, entity_id, bill_id, action, actor_user_id, actor_source, before_json, after_json, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?)`,
    [
      entityType,
      entityId,
      billId,
      action,
      actorUserId,
      actorSource,
      before === null ? null : JSON.stringify(before),
      after === null ? null : JSON.stringify(after),
      reason,
    ],
  );
}
