INSERT INTO users (username, display_name, password_hash, role)
VALUES ('admin', 'ผู้ดูแลระบบ', '__ADMIN_PASSWORD_HASH__', 'admin');

INSERT INTO settings (id, apartment_name, address, phone, office_hours, due_day)
VALUES (1, 'UtilityHub Apartment', 'กรุงเทพมหานคร', '020000000', '09:00–17:00 น.', 5);

INSERT INTO rooms (room_number, floor, area_sqm, status, water_baseline, electric_baseline)
SELECT (floor_no::text || LPAD(room_no::text, 2, '0')), floor_no,
       CASE WHEN floor_no = 2 AND room_no = 5 THEN 30.00 ELSE 28.00 END,
       CASE WHEN ((floor_no - 1) * 16 + room_no) <= 67 THEN 'Occupied' ELSE 'Vacant' END,
       CASE WHEN floor_no = 2 AND room_no = 5 THEN 1250.00 ELSE 0.00 END,
       CASE WHEN floor_no = 2 AND room_no = 5 THEN 5280.00 ELSE 0.00 END
FROM generate_series(1, 5) AS floors(floor_no)
CROSS JOIN generate_series(1, 16) AS rooms(room_no);

INSERT INTO tenants (room_id, full_name, phone, move_in_date, status, line_user_id, line_linked_at)
SELECT r.id, 'ผู้พักอาศัยห้อง ' || r.room_number, '08' || LPAD(r.id::text, 8, '0'), DATE '2026-01-01', 'Active',
       CASE WHEN r.id <= 54 THEN 'U-demo-' || LPAD(r.id::text, 3, '0') END,
       CASE WHEN r.id <= 54 THEN TIMESTAMPTZ '2026-01-01 09:00:00+07' END
FROM rooms r WHERE r.id <= 67;

INSERT INTO rates (utility_type, unit_price, effective_from, created_by)
VALUES ('water', 18.00, DATE '2026-01-01', 1),
       ('electric', 8.00, DATE '2026-01-01', 1),
       ('common', 35.00, DATE '2026-01-01', 1);

INSERT INTO meter_readings (room_id, period, utility_type, previous_reading, current_reading, recorded_by)
VALUES (21, '2026-08', 'water', 1240.00, 1250.00, 1),
       (21, '2026-08', 'electric', 5200.00, 5280.00, 1);
