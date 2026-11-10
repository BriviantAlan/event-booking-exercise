import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  api, cleanup, createBooking, createEvent, createUser, getBookingRow,
  isIsoTimestamp, missingId, seatsTaken,
} from './helpers.js';

after(cleanup);

describe('Part 2: POST /events/:id/bookings', () => {
  let userId;

  before(async () => {
    userId = await createUser();
  });

  test('creates a confirmed booking and returns 201', async () => {
    const eventId = await createEvent({ capacity: 10 });

    const res = await api('POST', `/events/${eventId}/bookings`, { user_id: userId, seats: 3 });
    assert.equal(res.status, 201);
    assert.equal(typeof res.body.id, 'number');
    assert.equal(res.body.event_id, eventId);
    assert.equal(res.body.user_id, userId);
    assert.equal(res.body.seats, 3);
    assert.equal(res.body.status, 'confirmed');
    assert.equal(res.body.cancelled_at, null);
    assert.ok(isIsoTimestamp(res.body.created_at), `created_at should be an ISO 8601 string, got ${res.body.created_at}`);

    const row = await getBookingRow(res.body.id);
    assert.ok(row, 'booking should be saved in the database');
    assert.equal(row.seats, 3);
    assert.equal(row.status, 'confirmed');
  });

  test('reduces seats_remaining on the event', async () => {
    const eventId = await createEvent({ capacity: 10 });
    await api('POST', `/events/${eventId}/bookings`, { user_id: userId, seats: 4 });
    const res = await api('GET', `/events/${eventId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.seats_remaining, 6);
  });

  test('allows booking exactly the remaining seats, then rejects more', async () => {
    const eventId = await createEvent({ capacity: 5 });
    await createBooking({ eventId, userId, seats: 2 });

    const exact = await api('POST', `/events/${eventId}/bookings`, { user_id: userId, seats: 3 });
    assert.equal(exact.status, 201, 'booking the last 3 seats should succeed');

    const extra = await api('POST', `/events/${eventId}/bookings`, { user_id: userId, seats: 1 });
    assert.equal(extra.status, 409, 'event is now sold out');
    assert.equal(typeof extra.body?.error, 'string');
    assert.equal(await seatsTaken(eventId), 5);
  });

  test('returns 409 when there are not enough seats (cancelled bookings free seats)', async () => {
    const eventId = await createEvent({ capacity: 5 });
    await createBooking({ eventId, userId, seats: 3 });
    await createBooking({ eventId, userId, seats: 2, status: 'cancelled' });

    const tooMany = await api('POST', `/events/${eventId}/bookings`, { user_id: userId, seats: 3 });
    assert.equal(tooMany.status, 409);

    const fits = await api('POST', `/events/${eventId}/bookings`, { user_id: userId, seats: 2 });
    assert.equal(fits.status, 201, 'the 2 cancelled seats are available again');
  });

  test('returns 409 when the event has already started', async () => {
    const eventId = await createEvent({ capacity: 10, startsInHours: -1 });
    const res = await api('POST', `/events/${eventId}/bookings`, { user_id: userId, seats: 1 });
    assert.equal(res.status, 409);
    assert.equal(await seatsTaken(eventId), 0);
  });

  test('returns 404 when the event does not exist', async () => {
    const res = await api('POST', `/events/${await missingId('events')}/bookings`, { user_id: userId, seats: 1 });
    assert.equal(res.status, 404);
  });

  test('returns 400 for an invalid event id', async () => {
    const res = await api('POST', '/events/abc/bookings', { user_id: userId, seats: 1 });
    assert.equal(res.status, 400);
  });

  test('returns 400 when the user does not exist', async () => {
    const eventId = await createEvent({ capacity: 10 });
    const res = await api('POST', `/events/${eventId}/bookings`, { user_id: await missingId('users'), seats: 1 });
    assert.equal(res.status, 400);
    assert.equal(typeof res.body?.error, 'string');
    assert.equal(await seatsTaken(eventId), 0);
  });

  const invalidBodies = [
    ['missing user_id', { seats: 1 }],
    ['user_id = 0', { user_id: 0, seats: 1 }],
    ['user_id = -1', { user_id: -1, seats: 1 }],
    ['user_id = 1.5', { user_id: 1.5, seats: 1 }],
    ['user_id = "abc"', { user_id: 'abc', seats: 1 }],
    ['user_id = null', { user_id: null, seats: 1 }],
    ['missing seats', { user_id: 'USER' }],
    ['seats = 0', { user_id: 'USER', seats: 0 }],
    ['seats = 11', { user_id: 'USER', seats: 11 }],
    ['seats = 2.5', { user_id: 'USER', seats: 2.5 }],
    ['seats = "abc"', { user_id: 'USER', seats: 'abc' }],
    ['seats = null', { user_id: 'USER', seats: null }],
    ['empty body', {}],
  ];

  for (const [name, template] of invalidBodies) {
    test(`returns 400 for an invalid body: ${name}`, async () => {
      const eventId = await createEvent({ capacity: 50 });
      const body = { ...template };
      if (body.user_id === 'USER') body.user_id = userId;
      const res = await api('POST', `/events/${eventId}/bookings`, body);
      assert.equal(res.status, 400);
      assert.equal(typeof res.body?.error, 'string', 'error responses have an "error" message');
      assert.equal(await seatsTaken(eventId), 0);
    });
  }
});

describe('Part 2: concurrency', () => {
  test('never overbooks when 25 people try to book the last 5 seats at once', async () => {
    const eventId = await createEvent({ title: 'Popular event', capacity: 5 });
    const users = [];
    for (let i = 0; i < 25; i++) users.push(await createUser(`Fan ${i + 1}`));

    const results = await Promise.all(
      users.map((u) => api('POST', `/events/${eventId}/bookings`, { user_id: u, seats: 1 })),
    );
    const statuses = results.map((r) => r.status);
    const ok = statuses.filter((s) => s === 201).length;
    const conflict = statuses.filter((s) => s === 409).length;

    assert.equal(ok + conflict, 25, `every response should be 201 or 409, got: ${statuses.join(', ')}`);
    assert.equal(await seatsTaken(eventId), ok, 'every 201 should correspond to a saved booking');
    assert.equal(ok, 5, `exactly 5 bookings should succeed, but ${ok} did`);
  });

  test('never overbooks with multi-seat requests', async () => {
    const eventId = await createEvent({ title: 'Popular event (groups)', capacity: 10 });
    const users = [];
    for (let i = 0; i < 20; i++) users.push(await createUser(`Group ${i + 1}`));

    const results = await Promise.all(
      users.map((u) => api('POST', `/events/${eventId}/bookings`, { user_id: u, seats: 3 })),
    );
    const statuses = results.map((r) => r.status);
    const ok = statuses.filter((s) => s === 201).length;

    assert.ok(statuses.every((s) => s === 201 || s === 409), `every response should be 201 or 409, got: ${statuses.join(', ')}`);
    assert.equal(await seatsTaken(eventId), ok * 3);
    assert.equal(ok, 3, `3 groups of 3 fit into 10 seats, but ${ok} were confirmed`);
  });
});
