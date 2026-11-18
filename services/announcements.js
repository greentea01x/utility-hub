import { withTx } from '../db/tx.js';
import { recordAudit } from '../lib/audit.js';

export async function createAnnouncement({ title, body, audience }, userId) {
  return withTx(async (connection) => {
    const [[announcement]] = await connection.execute(
      'INSERT INTO announcements (title, body, audience, created_by) VALUES (?, ?, ?, ?) RETURNING id, title, body, audience, created_by, created_at',
      [title, body, audience, userId],
    );
    await recordAudit(connection, {
      entityType: 'announcement',
      entityId: announcement.id,
      action: 'ANNOUNCEMENT_SEND',
      actorUserId: userId,
      after: { ...announcement, delivery_status: 'not_dispatched' },
    });
    return announcement;
  });
}
