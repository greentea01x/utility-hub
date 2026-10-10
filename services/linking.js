import crypto from 'node:crypto';
import pool from '../db/pool.js';

export async function createLinkCode(tenantId) {
  const code = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  await pool.execute(
    "INSERT INTO link_codes (tenant_id, code, expires_at) VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '7 days')",
    [tenantId, code],
  );
  return code;
}

export async function consumeLinkCode(code, lineUserId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[link]] = await connection.execute(
      'SELECT id, tenant_id FROM link_codes WHERE code = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP FOR UPDATE',
      [code],
    );
    if (!link) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      'UPDATE tenants SET line_user_id = ?, line_linked_at = CURRENT_TIMESTAMP WHERE id = ?',
      [lineUserId, link.tenant_id],
    );
    await connection.execute('UPDATE link_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [link.id]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
