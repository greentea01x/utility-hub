import pool from '../db/pool.js';

export async function runDailyJob() {
  const [[result]] = await pool.execute(`
    WITH today AS (
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date AS day
    ), eligible AS (
      SELECT b.id AS bill_id, t.id AS tenant_id, today.day AS send_date,
        CASE WHEN b.due_date = today.day + 2 THEN 'PRE_DUE' ELSE 'OVERDUE' END AS type
      FROM bills b
      JOIN tenants t ON t.room_id = b.room_id AND t.status = 'Active'
      CROSS JOIN today
      WHERE b.status = 'Unpaid'
        AND (b.due_date = today.day + 2 OR today.day - b.due_date IN (1, 8, 15))
        AND NOT EXISTS (
          SELECT 1 FROM payments p WHERE p.bill_id = b.id AND p.voided_at IS NOT NULL
        )
    ), queued AS (
      INSERT INTO notifications (bill_id, tenant_id, type, body, send_date)
      SELECT bill_id, tenant_id, type,
        CASE WHEN type = 'OVERDUE' THEN 'มีบิลค้างชำระ กรุณาติดต่อสำนักงาน'
          ELSE 'บิลของคุณใกล้ครบกำหนดชำระ' END,
        send_date
      FROM eligible
      ON CONFLICT DO NOTHING
      RETURNING id
    )
    SELECT (SELECT COUNT(*)::int FROM queued) AS queued,
      (SELECT COUNT(*)::int FROM eligible) AS checked
  `);
  return result;
}
