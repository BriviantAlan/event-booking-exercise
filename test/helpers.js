// Shared helpers for the API tests.
//
// The tests talk to the running API over HTTP (API_URL) and insert their own
// fixture rows straight into MySQL. Everything they create is deleted again in
// cleanup(), so your seed data is left alone.

import mysql from 'mysql2/promise';

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';

let connection;

export async function db() {
  connection ??= await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USER ?? 'app',
    password: process.env.DB_PASSWORD ?? 'app',
    database: process.env.DB_NAME ?? 'interview',
    timezone: 'Z',
    decimalNumbers: true,
  });
  return connection;
}

/** Calls the API and returns { status, body } (body is parsed JSON when possible). */
export async function api(method, path, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(API_URL + path, init);
  const text = await res.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // leave as text
  }
  return { status: res.status, body: parsed };
}

const tag = `t${process.pid}${Date.now().toString(36)}`;
const created = { users: [], events: [] };
let counter = 0;

export async function createUser(name = 'Test User') {
  const conn = await db();
  const email = `${tag}-${++counter}@test.invalid`;
  const [result] = await conn.query('INSERT INTO users (name, email) VALUES (?, ?)', [name, email]);
  created.users.push(result.insertId);
  return result.insertId;
}

/** Creates an event that starts `startsInHours` from now (negative = in the past). */
export async function createEvent({ title = 'Test event', capacity = 10, startsInHours = 48 } = {}) {
  const conn = await db();
  const [result] = await conn.query(
    `INSERT INTO events (title, venue, starts_at, capacity)
     VALUES (?, 'Test Venue', NOW() + INTERVAL ? HOUR, ?)`,
    [`[${tag}] ${title}`, startsInHours, capacity],
  );
  created.events.push(result.insertId);
  return result.insertId;
}

export async function createBooking({ eventId, userId, seats = 1, status = 'confirmed', createdHoursAgo = 0 }) {
  const conn = await db();
  const [result] = await conn.query(
    `INSERT INTO bookings (event_id, user_id, seats, status, created_at, cancelled_at)
     VALUES (?, ?, ?, ?, NOW() - INTERVAL ? HOUR, IF(? = 'cancelled', NOW(), NULL))`,
    [eventId, userId, seats, status, createdHoursAgo, status],
  );
  return result.insertId;
}

export async function getBookingRow(id) {
  const conn = await db();
  const [rows] = await conn.query('SELECT * FROM bookings WHERE id = ?', [id]);
  return rows[0];
}

export async function seatsTaken(eventId) {
  const conn = await db();
  const [[row]] = await conn.query(
    `SELECT COALESCE(SUM(seats), 0) AS taken FROM bookings
     WHERE event_id = ? AND status = 'confirmed'`,
    [eventId],
  );
  return Number(row.taken);
}

/** An id that is guaranteed not to exist in `table`. */
export async function missingId(table) {
  const conn = await db();
  const [[row]] = await conn.query(`SELECT COALESCE(MAX(id), 0) + 100000 AS id FROM ${table}`);
  return Number(row.id);
}

/** Fetches every page of GET /events and returns all items. */
export async function getAllUpcomingEvents() {
  const items = [];
  for (let offset = 0; ; offset += 100) {
    const res = await api('GET', `/events?limit=100&offset=${offset}`);
    if (res.status !== 200) throw new Error(`GET /events returned ${res.status}`);
    items.push(...res.body.data);
    if (res.body.data.length < 100) return items;
  }
}

export async function cleanup() {
  const conn = await db();
  if (created.events.length) {
    await conn.query('DELETE FROM bookings WHERE event_id IN (?)', [created.events]);
  }
  if (created.users.length) {
    await conn.query('DELETE FROM bookings WHERE user_id IN (?)', [created.users]);
  }
  if (created.events.length) {
    await conn.query('DELETE FROM events WHERE id IN (?)', [created.events]);
  }
  if (created.users.length) {
    await conn.query('DELETE FROM users WHERE id IN (?)', [created.users]);
  }
  created.users = [];
  created.events = [];
  await conn.end();
  connection = undefined;
}

export function isIsoTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && /T.*(Z|[+-]\d\d:\d\d)$/.test(value);
}
