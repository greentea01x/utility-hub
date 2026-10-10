ALTER TABLE notifications ADD COLUMN IF NOT EXISTS bill_id BIGINT REFERENCES bills(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS send_date DATE NOT NULL
  DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_reminder
  ON notifications(bill_id, tenant_id, type, send_date)
  WHERE bill_id IS NOT NULL AND type IN ('PRE_DUE', 'OVERDUE');
