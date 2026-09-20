SET NAMES utf8mb4;
SET time_zone = '+07:00';
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS rates;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS meter_readings;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  password_hash CHAR(60) NOT NULL,
  role ENUM('admin','staff') NOT NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  apartment_name VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL,
  tax_id VARCHAR(13) NULL,
  phone VARCHAR(20) NOT NULL,
  office_hours VARCHAR(60) NOT NULL,
  due_day TINYINT UNSIGNED NOT NULL DEFAULT 5,
  line_test_mode TINYINT(1) NOT NULL DEFAULT 1,
  line_test_user_id VARCHAR(64) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT ck_settings_singleton CHECK (id = 1),
  CONSTRAINT ck_settings_due_day CHECK (due_day BETWEEN 1 AND 28)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE rooms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_number VARCHAR(10) NOT NULL,
  floor TINYINT UNSIGNED NOT NULL,
  area_sqm DECIMAL(6,2) NOT NULL,
  status ENUM('Vacant','Occupied','Inactive') NOT NULL DEFAULT 'Vacant',
  water_baseline DECIMAL(12,2) NOT NULL DEFAULT 0,
  electric_baseline DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rooms_number (room_number),
  CONSTRAINT ck_rooms_area CHECK (area_sqm > 0),
  CONSTRAINT ck_rooms_floor CHECK (floor BETWEEN 1 AND 99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tenants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone CHAR(10) NOT NULL,
  move_in_date DATE NOT NULL,
  move_out_date DATE NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  line_user_id VARCHAR(64) NULL,
  line_linked_at DATETIME NULL,
  active_room_id BIGINT UNSIGNED GENERATED ALWAYS AS (IF(status = 'Active', room_id, NULL)) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenants_active_room (active_room_id),
  UNIQUE KEY uq_tenants_line_user (line_user_id),
  CONSTRAINT fk_tenants_room FOREIGN KEY (room_id) REFERENCES rooms(id),
  CONSTRAINT ck_tenants_phone CHECK (phone REGEXP '^0[0-9]{9}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE rates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  utility_type ENUM('water','electric','common') NOT NULL,
  unit_price DECIMAL(8,2) NOT NULL,
  effective_from DATE NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rates_utility_date (utility_type, effective_from),
  CONSTRAINT fk_rates_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT ck_rates_price CHECK (unit_price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE meter_readings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  period CHAR(7) NOT NULL,
  utility_type ENUM('water','electric') NOT NULL,
  previous_reading DECIMAL(12,2) NOT NULL,
  current_reading DECIMAL(12,2) NOT NULL,
  meter_replaced TINYINT(1) NOT NULL DEFAULT 0,
  recorded_by BIGINT UNSIGNED NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_readings_room_period_utility (room_id, period, utility_type),
  CONSTRAINT fk_readings_room FOREIGN KEY (room_id) REFERENCES rooms(id),
  CONSTRAINT fk_readings_user FOREIGN KEY (recorded_by) REFERENCES users(id),
  CONSTRAINT ck_readings_period CHECK (period REGEXP '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT ck_readings_current CHECK (current_reading >= previous_reading)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
