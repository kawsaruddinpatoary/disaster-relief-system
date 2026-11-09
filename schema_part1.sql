-- =====================================================================
--  Disaster Relief & Emergency Resource Routing System
--  Schema Part 1 : users, categories, resources
--  Raw MySQL (no ORM) - MySQL 8.x compatible
--  Seed passwords (scrypt hashed): admin123 / volunteer123 / donor123
-- =====================================================================

CREATE DATABASE IF NOT EXISTS disaster_relief
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE disaster_relief;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- users : system accounts (admin / volunteer / donor)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  role        ENUM('admin','volunteer','donor') NOT NULL DEFAULT 'volunteer',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- categories : fixed resource categories (Rice, Water, Medicine)
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id          INT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  description VARCHAR(255)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- resources : physical inventory tracked per category / location
-- ---------------------------------------------------------------------
CREATE TABLE resources (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT           NOT NULL,
  name        VARCHAR(120)  NOT NULL,
  quantity    INT           NOT NULL DEFAULT 0,
  status      ENUM('available','reserved','dispatched') NOT NULL DEFAULT 'available',
  location    VARCHAR(150)  NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resources_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  SAMPLE DATA
-- =====================================================================

-- 3 users (one per role)
INSERT INTO users (id, name, email, password, role) VALUES
(1, 'Amina Rahman',  'admin@relief.org',     '182b46ac4a3fcb2fd99190ef9be183ab:eb9a2c6d5c7564bcdec1741bf6f7844f8f7924f727dc68c8ab4eeadc111cf70deee07b2345ddf728605f1b6f507c3558d922b88d07779ffc84ad12674cf6ebf4', 'admin'),
(2, 'Karim Hossain',  'volunteer@relief.org', 'f3aae12da55831879fa9e7f5830f4f57:8137157dd6547ffeb5f782ecb8995fb82978a8e0e9814d8d6bd7cec8319f416bb571305fe6c9ca05f4e105ff6166fc3df474f753f1b998f60f14869f86009429', 'volunteer'),
(3, 'Sara Ahmed',     'donor@relief.org',     '18da950d4675120a5803771f61106505:6aaf245ccc4a20a858b6ac7c1d7a72f7c91916b2fda41dc7cf21682dd4e75cb33d72b2369572da45e6b1e47ecad2d2577af713c5e967690d7819b99591b79ecc', 'donor');

-- 3 categories
INSERT INTO categories (id, name, description) VALUES
(1, 'Rice',      'Staple food grains and packaged rice sacks'),
(2, 'Water',     'Bottled water, purification tablets, tanks'),
(3, 'Medicine',  'First-aid kits, essential medicines, PPE');

-- 5 resources
INSERT INTO resources (id, category_id, name, quantity, status, location) VALUES
(1, 1, 'Rice Sacks 25kg',        120, 'available',  'Dhaka Central Warehouse'),
(2, 2, 'Bottled Water 1L x24',    85, 'available',  'Chattogram Relief Hub'),
(3, 2, 'Water Tank 1000L',        12, 'reserved',   'Sylhet Field Camp'),
(4, 3, 'First Aid Kit (Basic)',   40, 'available',  'Dhaka Central Warehouse'),
(5, 3, 'Paracetamol Box x100',    25, 'dispatched', 'Cox\'s Bazar Distribution Point');
