import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  api, cleanup, createBooking, createEvent, createUser, getBookingRow,
  isIsoTimestamp, missingId,
} from './helpers.js';

after(cleanup);

describe('Part 3: GET /users/:id/bookings', () => {
  let userId;
  let otherUserId;
  let lonelyUserId;
  let eventA;
  let eventB;
  let oldBooking;
  let cancelledBooking;
  let newestBooking;

  before(async () => {
    userId = await createUser('Booker');
    otherUserId = await createUser('Someone else');
    lonelyUserId = await createUser('No bookings');
    eventA = await createEvent({ title: 'Event A', capacity: 20 });
    eventB = await createEvent({ title: 'Event B', capacity: 20, startsInHours: -5 });

    // Inserted first, so it has the highest id, but it was created 2 days ago.
    newestBooking = await createBooking({ eventId: eventA, userId, seats: 1 });
    oldBooking = await createBooking({ eventId: eventA, userId, seats: 2, createdHoursAgo: 48 });
    cancelledBooking = await createBooking({ eventId: eventB, userId, seats: 3, status: 'cancelled', createdHoursAgo: 1 });
    await createBooking({ eventId: eventA, userId: otherUserId, seats: 4 });
  });

  test('lists all of the user\'s bookings, newest first, with an event summary', async () => {
    const res = await api('GET', `/users/${userId}/bookings`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body?.data), 'body.data should be an array');
    assert.deepEqual(
      res.body.data.map((b) => b.id),
      [newestBooking, cancelledBooking, oldBooking],
      'sorted by created_at descending; other users\' bookings are not included',
    );

    const cancelled = res.body.data.find((b) => b.id === cancelledBooking);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.seats, 3);
    assert.equal(cancelled.event_id, eventB);
    assert.equal(cancelled.user_id, userId);
    assert.ok(isIsoTimestamp(cancelled.created_at));
    assert.ok(isIsoTimestamp(cancelled.cancelled_at), 'cancelled_at is set for cancelled bookings');
    assert.equal(cancelled.event?.id, eventB);
    assert.match(cancelled.event?.title ?? '', /Event B$/);
    assert.ok(isIsoTimestamp(cancelled.event?.starts_at), 'event.starts_at should be an ISO 8601 string');

    const confirmed = res.body.data.find((b) => b.id === newestBooking);
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(confirmed.cancelled_at, null);
    assert.match(confirmed.event?.title ?? '', /Event A$/);
  });

  test('returns an empty list for a user with no bookings', async () => {
    const res = await api('GET', `/users/${lonelyUserId}/bookings`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body?.data, []);
  });

  test('returns 404 for a user that does not exist', async () => {
    const res = await api('GET', `/users/${await missingId('users')}/bookings`);
    assert.equal(res.status, 404);
    assert.equal(typeof res.body?.error, 'string');
  });

  test('returns 400 for an invalid user id', async () => {
    const res = await api('GET', '/users/abc/bookings');
    assert.equal(res.status, 400);
  });
});

describe('Part 3: POST /bookings/:id/cancel', () => {
  let userId;

  before(async () => {
    userId = await createUser('Canceller');
  });

  test('cancels a booking and returns it', async () => {
    const eventId = await createEvent({ capacity: 10 });
    const bookingId = await createBooking({ eventId, userId, seats: 2 });

    const res = await api('POST', `/bookings/${bookingId}/cancel`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, bookingId);
    assert.equal(res.body.event_id, eventId);
    assert.equal(res.body.seats, 2);
    assert.equal(res.body.status, 'cancelled');
    assert.ok(isIsoTimestamp(res.body.cancelled_at), `cancelled_at should be an ISO 8601 string, got ${res.body.cancelled_at}`);

    const row = await getBookingRow(bookingId);
    assert.equal(row.status, 'cancelled');
    assert.ok(row.cancelled_at, 'cancelled_at should be saved in the database');
  });

  test('frees the seats so someone else can book them', async () => {
    const eventId = await createEvent({ capacity: 2 });
    const bookingId = await createBooking({ eventId, userId, seats: 2 });

    const soldOut = await api('GET', `/events/${eventId}`);
    assert.equal(soldOut.body.seats_remaining, 0);

    assert.equal((await api('POST', `/bookings/${bookingId}/cancel`)).status, 200);

    const freed = await api('GET', `/events/${eventId}`);
    assert.equal(freed.body.seats_remaining, 2);

    const rebook = await api('POST', `/events/${eventId}/bookings`, { user_id: userId, seats: 2 });
    assert.equal(rebook.status, 201);
  });

  test('returns 409 when the booking is already cancelled', async () => {
    const eventId = await createEvent({ capacity: 10 });
    const bookingId = await createBooking({ eventId, userId, seats: 1, status: 'cancelled' });
    const rowBefore = await getBookingRow(bookingId);

    const res = await api('POST', `/bookings/${bookingId}/cancel`);
    assert.equal(res.status, 409);
    assert.equal(typeof res.body?.error, 'string');

    const rowAfter = await getBookingRow(bookingId);
    assert.deepEqual(rowAfter.cancelled_at, rowBefore.cancelled_at, 'cancelled_at should not change');
  });

  test('returns 404 for a booking that does not exist', async () => {
    const res = await api('POST', `/bookings/${await missingId('bookings')}/cancel`);
    assert.equal(res.status, 404);
  });

  test('returns 400 for an invalid booking id', async () => {
    const res = await api('POST', '/bookings/abc/cancel');
    assert.equal(res.status, 400);
  });
});
