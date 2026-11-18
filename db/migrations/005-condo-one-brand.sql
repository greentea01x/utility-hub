UPDATE settings SET apartment_name = 'Condo one', updated_at = CURRENT_TIMESTAMP
WHERE id = 1 AND apartment_name IN (
  'สุขธารา เรสซิเดนซ์', 'ศุภาลัย เรสซิเดนซ์',
  'UtilityHub Apartment', 'UtilityHub', 'Utility Hub'
);
