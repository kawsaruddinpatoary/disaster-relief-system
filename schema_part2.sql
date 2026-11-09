-- =====================================================================
--  Disaster Relief & Emergency Resource Routing System
--  Schema Part 2 : relief_requests, resource_dispatches
--  Raw MySQL (no ORM) - MySQL 8.x compatible
--  Run AFTER schema_part1.sql (needs users / categories / resources)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS disaster_relief
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE disaster_relief;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS resource_dispatches;
DROP TABLE IF EXISTS relief_requests;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- relief_requests : a beneficiary/volunteer asks for help in a location
-- ---------------------------------------------------------------------
CREATE TABLE relief_requests (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  requested_by_user_id INT          NOT NULL,
  category_id         INT           NOT NULL,
  location            VARCHAR(150)  NOT NULL,
  status              ENUM('pending','approved','dispatched','fulfilled') NOT NULL DEFAULT 'pending',
  priority            ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_relief_requests_user
    FOREIGN KEY (requested_by_user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_relief_requests_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- resource_dispatches : a resource physically sent against a request
-- ---------------------------------------------------------------------
CREATE TABLE resource_dispatches (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  request_id    INT NOT NULL,
  resource_id   INT NOT NULL,
  volunteer_id  INT NOT NULL,
  dispatch_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dispatches_request
    FOREIGN KEY (request_id) REFERENCES relief_requests (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_dispatches_resource
    FOREIGN KEY (resource_id) REFERENCES resources (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_dispatches_volunteer
    FOREIGN KEY (volunteer_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  SAMPLE DATA
-- =====================================================================

-- 4 relief requests (2 waiting for approval, 2 already dispatched)
INSERT INTO relief_requests
  (id, requested_by_user_id, category_id, location, status, priority, created_at) VALUES
(1, 2, 1, 'Charpia Village, Sylhet',        'pending',    'high',   '2026-11-01 08:15:00'),
(2, 3, 2, 'Kurigram Flood Shelter',         'dispatched', 'high',   '2026-11-02 10:40:00'),
(3, 1, 3, 'Barguna Cyclone Response Zone',  'dispatched', 'medium', '2026-11-03 14:05:00'),
(4, 2, 2, 'Noakhali Coastal Belt',          'approved',   'low',    '2026-11-04 09:20:00');

-- 2 dispatches (volunteer = user 2, Karim Hossain)
INSERT INTO resource_dispatches
  (id, request_id, resource_id, volunteer_id, dispatch_date) VALUES
(1, 2, 1, 2, '2026-11-02 16:30:00'),
(2, 3, 5, 2, '2026-11-03 18:10:00');

-- Keep inventory statuses consistent with the dispatches above
UPDATE resources SET status = 'dispatched' WHERE id IN (1, 5);
