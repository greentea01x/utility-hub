INSERT INTO users (username, display_name, password_hash, role)
VALUES ('admin', 'ผู้ดูแลระบบ', '__ADMIN_PASSWORD_HASH__', 'admin');

INSERT INTO settings (id, apartment_name, address, phone, office_hours, due_day)
VALUES (1, 'UtilityHub Apartment', 'กรุงเทพมหานคร', '020000000', '09:00–17:00 น.', 5);
