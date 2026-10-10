CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(30) NOT NULL,
  entity_id BIGINT NOT NULL,
  bill_id BIGINT REFERENCES bills(id),
  action VARCHAR(30) NOT NULL CHECK (action IN (
    'BILL_APPROVE', 'BILL_REVERT', 'PAYMENT_CONFIRM', 'PAYMENT_VOID',
    'RATE_CHANGE', 'ROOM_CREATE', 'ROOM_EDIT', 'ROOM_AREA_CHANGE',
    'ROOM_DEACTIVATE', 'ROOM_ACTIVATE', 'READING_CREATE', 'READING_EDIT',
    'METER_REPLACEMENT', 'TENANT_LINE_LINK', 'TENANT_LINE_UNLINK',
    'TENANCY_END', 'ANNOUNCEMENT_SEND'
  )),
  actor_user_id BIGINT REFERENCES users(id),
  actor_source VARCHAR(20) NOT NULL DEFAULT 'user',
  before_json JSONB,
  after_json JSONB,
  reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((actor_source = 'user' AND actor_user_id IS NOT NULL) OR
    (actor_source = 'line_webhook' AND actor_user_id IS NULL AND action = 'TENANT_LINE_LINK')),
  CHECK (action NOT IN ('BILL_REVERT', 'PAYMENT_VOID', 'METER_REPLACEMENT', 'TENANCY_END')
    OR (reason IS NOT NULL AND length(reason) >= 10))
);
CREATE INDEX IF NOT EXISTS ix_audit_bill_created ON audit_log(bill_id, created_at);
CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log(entity_type, entity_id, created_at);

-- Prevent normal application SQL from rewriting history, including TRUNCATE.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = '55000';
END;
$$;
DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();
