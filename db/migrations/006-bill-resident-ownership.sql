-- Existing bills intentionally retain NULL. Their occupant cannot be inferred
-- safely from the room's current tenant and must be verified before assignment.
ALTER TABLE bills ADD COLUMN IF NOT EXISTS tenant_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'bills'::regclass AND conname = 'fk_bills_tenant'
  ) THEN
    ALTER TABLE bills ADD CONSTRAINT fk_bills_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_bills_resident_period
  ON bills (tenant_id, period) WHERE tenant_id IS NOT NULL;
