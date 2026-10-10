import crypto from 'node:crypto';
import pool from '../db/pool.js';
import { withTx } from '../db/tx.js';
import { recordAudit } from '../lib/audit.js';

export async function createLinkCode(tenantId) {
  const code = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  await pool.execute(
    "INSERT INTO link_codes (tenant_id, code, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '7 days')",
    [tenantId, code],
  );
  return code;
}

export async function consumeLinkCode(code, lineUserId) {
  return withTx(async (connection) => {
    const [[link]] = await connection.execute(
      'SELECT id, tenant_id FROM link_codes WHERE code = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP FOR UPDATE',
      [code],
    );
    if (!link) return false;
    const columns = 'id, room_id, line_user_id, line_linked_at';
    const [[before]] = await connection.execute(
      `SELECT ${columns} FROM tenants WHERE id = ? FOR UPDATE`,
      [link.tenant_id],
    );
    const [[after]] = await connection.execute(
      `UPDATE tenants SET line_user_id = ?, line_linked_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING ${columns}`,
      [lineUserId, link.tenant_id],
    );
    await connection.execute('UPDATE link_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [
      link.id,
    ]);
    await recordAudit(connection, {
      entityType: 'tenant',
      entityId: link.tenant_id,
      action: 'TENANT_LINE_LINK',
      actorSource: 'line_webhook',
      before,
      after,
    });
    return true;
  });
}
