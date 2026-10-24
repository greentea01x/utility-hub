-- Existing records retain NULL: their technician name must never be invented.
-- New saves require a manually entered name in the application and service.
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS technician_name VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'meter_readings'::regclass
      AND conname = 'ck_meter_readings_technician_name'
  ) THEN
    ALTER TABLE meter_readings ADD CONSTRAINT ck_meter_readings_technician_name
      CHECK (technician_name IS NULL OR char_length(btrim(technician_name)) BETWEEN 2 AND 100);
  END IF;
END;
$$;
