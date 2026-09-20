INSERT INTO users (username, display_name, password_hash, role)
VALUES ('admin', 'ผู้ดูแลระบบ', '__ADMIN_PASSWORD_HASH__', 'admin');

INSERT INTO settings (id, apartment_name, address, phone, office_hours, due_day)
VALUES (1, 'UtilityHub Apartment', 'กรุงเทพมหานคร', '020000000', '09:00–17:00 น.', 5);

INSERT INTO rooms (room_number, floor, area_sqm, status, water_baseline, electric_baseline)
WITH RECURSIVE seq AS (
  SELECT 1 AS n
  UNION ALL SELECT n + 1 FROM seq WHERE n < 80
)
SELECT CONCAT(FLOOR((n - 1) / 10) + 1, LPAD(((n - 1) % 10) + 1, 2, '0')),
       FLOOR((n - 1) / 10) + 1,
       IF(n = 15, 30.00, 28.00),
       IF(n <= 67, 'Occupied', 'Vacant'),
       IF(n = 15, 1250.00, 0.00),
       IF(n = 15, 5280.00, 0.00)
FROM seq;

INSERT INTO tenants (room_id, full_name, phone, move_in_date, status, line_user_id, line_linked_at)
WITH RECURSIVE seq AS (
  SELECT 1 AS n
  UNION ALL SELECT n + 1 FROM seq WHERE n < 67
)
SELECT r.id, CONCAT('ผู้พักอาศัยห้อง ', r.room_number), CONCAT('08', LPAD(r.id, 8, '0')), '2026-01-01', 'Active',
       IF(seq.n <= 54, CONCAT('U-demo-', LPAD(seq.n, 3, '0')), NULL),
       IF(seq.n <= 54, '2026-01-01 09:00:00', NULL)
FROM seq JOIN rooms r ON r.id = seq.n;

INSERT INTO rates (utility_type, unit_price, effective_from, created_by)
VALUES ('water', 18.00, '2026-01-01', 1),
       ('electric', 8.00, '2026-01-01', 1),
       ('common', 35.00, '2026-01-01', 1);

INSERT INTO meter_readings (room_id, period, utility_type, previous_reading, current_reading, recorded_by)
VALUES (15, '2026-08', 'water', 1240.00, 1250.00, 1),
       (15, '2026-08', 'electric', 5200.00, 5280.00, 1);
