-- Event Booking exercise: schema
--
-- The MySQL container loads this file automatically the first time it starts
-- (see docker-compose.yml). To reload from scratch:
--   docker compose down -v && docker compose up --build
--
-- All DATETIME values are stored in UTC (the server runs with time_zone = '+00:00').

SET NAMES utf8mb4;

CREATE TABLE users (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(255)  NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE events (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  title       VARCHAR(200)  NOT NULL,
  venue       VARCHAR(200)  NOT NULL,
  starts_at   DATETIME      NOT NULL COMMENT 'UTC',
  capacity    INT UNSIGNED  NOT NULL COMMENT 'Total number of seats',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bookings (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  event_id      INT UNSIGNED  NOT NULL,
  user_id       INT UNSIGNED  NOT NULL,
  seats         INT UNSIGNED  NOT NULL,
  status        ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at  DATETIME      NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_bookings_event FOREIGN KEY (event_id) REFERENCES events (id),
  CONSTRAINT fk_bookings_user  FOREIGN KEY (user_id)  REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
