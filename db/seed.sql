-- Event Booking exercise: sample data
--
-- Event dates are relative to the day the database is created, so there are
-- always upcoming events no matter when you run this.

SET NAMES utf8mb4;

INSERT INTO users (id, name, email) VALUES
  (1, 'Maya Patel',   'maya.patel@example.com'),
  (2, 'Liam Chen',    'liam.chen@example.com'),
  (3, 'Sofia Garcia', 'sofia.garcia@example.com'),
  (4, 'Noah Kim',     'noah.kim@example.com'),
  (5, 'Amara Okafor', 'amara.okafor@example.com'),
  (6, 'Lucas Rossi',  'lucas.rossi@example.com');

INSERT INTO events (id, title, venue, starts_at, capacity) VALUES
  ( 1, 'Intro to SQL Indexing',           'Room 101',  TIMESTAMP(CURDATE() + INTERVAL  2 DAY, '18:00:00'),  30),
  ( 2, 'Designing REST APIs',             'Main Hall', TIMESTAMP(CURDATE() + INTERVAL  4 DAY, '17:30:00'), 100),
  ( 3, 'Docker for Developers',           'Room 204',  TIMESTAMP(CURDATE() + INTERVAL  6 DAY, '18:00:00'),   4),
  ( 4, 'Database Transactions Deep Dive', 'Room 101',  TIMESTAMP(CURDATE() + INTERVAL  9 DAY, '18:00:00'),  10),
  ( 5, 'Observability 101',               'Main Hall', TIMESTAMP(CURDATE() + INTERVAL 12 DAY, '16:00:00'),  50),
  ( 6, 'Caching Strategies',              'Room 204',  TIMESTAMP(CURDATE() + INTERVAL 15 DAY, '18:00:00'),  25),
  ( 7, 'Testing Backend Services',        'Room 101',  TIMESTAMP(CURDATE() + INTERVAL 20 DAY, '18:00:00'),  40),
  ( 8, 'Scaling MySQL',                   'Main Hall', TIMESTAMP(CURDATE() + INTERVAL 25 DAY, '17:00:00'),  80),
  ( 9, 'API Security Basics',             'Room 204',  TIMESTAMP(CURDATE() + INTERVAL 30 DAY, '18:00:00'),  20),
  (10, 'Message Queues in Practice',      'Room 101',  TIMESTAMP(CURDATE() + INTERVAL 35 DAY, '18:00:00'),  30),
  (11, 'Git Workflows That Scale',        'Room 101',  TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '18:00:00'),  30),
  (12, 'Intro to Node.js',                'Main Hall', TIMESTAMP(CURDATE() - INTERVAL  3 DAY, '18:00:00'),  60),
  (13, 'Lightning Talks',                 'Main Hall', TIMESTAMP(CURDATE() + INTERVAL  4 DAY, '17:30:00'),  15);

INSERT INTO bookings (event_id, user_id, seats, status, cancelled_at) VALUES
  -- Event 1: 3 of 30 taken (one cancelled booking doesn't count)
  ( 1, 1, 2, 'confirmed', NULL),
  ( 1, 2, 1, 'confirmed', NULL),
  ( 1, 3, 3, 'cancelled', NOW()),
  -- Event 2: 7 of 100 taken
  ( 2, 1, 4, 'confirmed', NULL),
  ( 2, 4, 2, 'confirmed', NULL),
  ( 2, 5, 1, 'confirmed', NULL),
  ( 2, 6, 2, 'cancelled', NOW()),
  -- Event 3: sold out (4 of 4)
  ( 3, 2, 2, 'confirmed', NULL),
  ( 3, 3, 2, 'confirmed', NULL),
  ( 3, 4, 1, 'cancelled', NOW()),
  -- Event 4: almost sold out (9 of 10)
  ( 4, 1, 5, 'confirmed', NULL),
  ( 4, 5, 4, 'confirmed', NULL),
  ( 4, 6, 3, 'cancelled', NOW()),
  -- Events 5, 7, 9, 13
  ( 5, 6, 1, 'confirmed', NULL),
  ( 7, 2, 2, 'confirmed', NULL),
  ( 9, 3, 1, 'confirmed', NULL),
  ( 9, 4, 1, 'confirmed', NULL),
  (13, 5, 3, 'confirmed', NULL),
  -- Past events
  (11, 1, 2, 'confirmed', NULL),
  (11, 2, 2, 'confirmed', NULL),
  (12, 3, 1, 'confirmed', NULL);
