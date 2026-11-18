UPDATE settings SET apartment_name = 'สุขธารา เรสซิเดนซ์', updated_at = CURRENT_TIMESTAMP
WHERE id = 1 AND apartment_name IN ('UtilityHub Apartment', 'UtilityHub', 'Utility Hub');
