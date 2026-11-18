import crypto from 'node:crypto';
import { withTx } from '../db/tx.js';
import { recordAudit } from '../lib/audit.js';
import { AppError } from '../lib/errors.js';

async function lockTenant(connection, tenantId) {
  const [[tenant]] = await connection.execute(
    `SELECT t.id, t.room_id, t.line_user_id, t.line_linked_at, t.status,
      t.move_out_date, r.status AS room_status
     FROM tenants t JOIN rooms r ON r.id = t.room_id WHERE t.id = ? FOR UPDATE OF t, r`,
    [tenantId],
  );
  return tenant;
}

const canLink = (tenant) =>
  tenant?.status === 'Active' && !tenant.move_out_date && tenant.room_status === 'Occupied';
const auditFields = ({ id, room_id, line_user_id, line_linked_at }) => ({
  id,
  room_id,
  line_user_id,
  line_linked_at,
});

export async function createLinkCode(tenantId) {
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0)
    throw new AppError(422, 'INVALID_TENANT', 'ข้อมูลผู้พักอาศัยไม่ถูกต้อง');
  return withTx(async (connection) => {
    const tenant = await lockTenant(connection, tenantId);
    if (!canLink(tenant))
      throw new AppError(409, 'TENANT_NOT_ACTIVE', 'ผู้พักอาศัยหรือห้องไม่พร้อมผูก LINE');
    await connection.execute(
      'UPDATE link_codes SET used_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND used_at IS NULL',
      [tenantId],
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = crypto.randomBytes(3).toString('hex').toUpperCase();
      const [rows] = await connection.execute(
        `INSERT INTO link_codes (tenant_id, code, expires_at)
         VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '7 days') ON CONFLICT (code) DO NOTHING RETURNING code`,
        [tenantId, code],
      );
      if (rows.length) return code;
    }
    throw new AppError(
      503,
      'LINK_CODE_UNAVAILABLE',
      'ยังสร้างรหัสผูก LINE ไม่สำเร็จ กรุณาลองอีกครั้ง',
    );
  });
}

export async function consumeLinkCode(code, lineUserId) {
  if (
    typeof code !== 'string' ||
    !/^[A-F0-9]{6}$/.test(code) ||
    typeof lineUserId !== 'string' ||
    !lineUserId.trim() ||
    lineUserId.length > 64
  )
    return false;
  return withTx(async (connection) => {
    const [[candidate]] = await connection.execute(
      'SELECT tenant_id FROM link_codes WHERE code = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP',
      [code],
    );
    if (!candidate) return false;
    // Use the same tenant → code lock order as code creation to avoid races and deadlocks.
    const tenant = await lockTenant(connection, candidate.tenant_id);
    if (!canLink(tenant) || (tenant.line_user_id && tenant.line_user_id !== lineUserId))
      return false;
    const [[link]] = await connection.execute(
      'SELECT id FROM link_codes WHERE code = ? AND tenant_id = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP FOR UPDATE',
      [code, candidate.tenant_id],
    );
    if (!link) return false;
    const [[after]] = await connection.execute(
      `UPDATE tenants SET line_user_id = ?, line_linked_at = CURRENT_TIMESTAMP WHERE id = ?
       RETURNING id, room_id, line_user_id, line_linked_at`,
      [lineUserId, candidate.tenant_id],
    );
    await connection.execute('UPDATE link_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [
      link.id,
    ]);
    await recordAudit(connection, {
      entityType: 'tenant',
      entityId: candidate.tenant_id,
      action: 'TENANT_LINE_LINK',
      actorSource: 'line_webhook',
      before: auditFields(tenant),
      after,
    });
    return true;
  });
}
