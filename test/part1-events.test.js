import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  api, cleanup, createBooking, createEvent, createUser, db,
  getAllUpcomingEvents, isIsoTimestamp, missingId,
} from './helpers.js';

after(cleanup);

describe('Part 1: GET /events', () => {
  let futureEventId;
  let emptyEventId;
  let onlyCancelledEventId;
  let pastEventId;

  before(async () => {
    const userA = await createUser();
    const userB = await createUser();

    futureEventId = await createEvent({ title: 'Future event', capacity: 10, startsInHours: 72 });
    await createBooking({ eventId: futureEventId, userId: userA, seats: 3 });
    await createBooking({ eventId: futureEventId, userId: userB, seats: 2 });
    await createBooking({ eventId: futureEventId, userId: userB, seats: 4, status: 'cancelled' });

    emptyEventId = await createEvent({ title: 'Event with no bookings', capacity: 7, startsInHours: 96 });

    onlyCancelledEventId = await createEvent({ title: 'Event with only cancelled bookings', capacity: 6, startsInHours: 100 });
    await createBooking({ eventId: onlyCancelledEventId, userId: userA, seats: 2, status: 'cancelled' });

    pastEventId = await createEvent({ title: 'Past event', capacity: 10, startsInHours: -24 });
    await createBooking({ eventId: pastEventId, userId: userA, seats: 1 });
  });

  test('returns 200 with data and pagination', async () => {
    const res = await api('GET', '/events');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body?.data), 'body.data should be an array');
    assert.deepEqual(res.body.pagination?.limit, 20, 'default limit is 20');
    assert.deepEqual(res.body.pagination?.offset, 0, 'default offset is 0');
    assert.equal(typeof res.body.pagination?.total, 'number', 'pagination.total should be a number');
  });

  test('each event has the documented fields, and seats_remaining ignores cancelled bookings', async () => {
    const events = await getAllUpcomingEvents();
    const event = events.find((e) => e.id === futureEventId);
    assert.ok(event, 'the upcoming test event should be listed');
    assert.equal(typeof event.title, 'string');
    assert.equal(event.venue, 'Test Venue');
    assert.equal(event.capacity, 10);
    assert.equal(event.seats_remaining, 5, 'capacity 10 - (3 + 2) confirmed; the cancelled 4 do not count');
    assert.ok(isIsoTimestamp(event.starts_at), `starts_at should be an ISO 8601 string, got ${event.starts_at}`);
  });

  test('events with no confirmed bookings are listed with all seats remaining', async () => {
    const events = await getAllUpcomingEvents();
    const empty = events.find((e) => e.id === emptyEventId);
    assert.ok(empty, 'an event with no bookings should be listed');
    assert.equal(empty.seats_remaining, 7);

    const onlyCancelled = events.find((e) => e.id === onlyCancelledEventId);
    assert.ok(onlyCancelled, 'an event whose only booking is cancelled should be listed');
    assert.equal(onlyCancelled.seats_remaining, 6);
  });

  test('only lists upcoming events', async () => {
    const events = await getAllUpcomingEvents();
    assert.ok(!events.some((e) => e.id === pastEventId), 'past events must not be listed');
    for (const e of events) {
      assert.ok(Date.parse(e.starts_at) > Date.now() - 60_000, `event ${e.id} starts in the past`);
    }
  });

  test('is sorted by starts_at, then id', async () => {
    const events = await getAllUpcomingEvents();
    for (let i = 1; i < events.length; i++) {
      const a = events[i - 1];
      const b = events[i];
      const ta = Date.parse(a.starts_at);
      const tb = Date.parse(b.starts_at);
      assert.ok(
        ta < tb || (ta === tb && a.id < b.id),
        `event ${a.id} (${a.starts_at}) should not come before event ${b.id} (${b.starts_at})`,
      );
    }
  });

  test('pagination.total is the number of upcoming events', async () => {
    const conn = await db();
    const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM events WHERE starts_at > NOW()');
    const res = await api('GET', '/events?limit=1');
    assert.equal(res.status, 200);
    assert.equal(res.body.pagination.total, Number(row.n));
    assert.equal(res.body.data.length, 1);
  });

  test('limit and offset select the right slice', async () => {
    const all = await getAllUpcomingEvents();
    assert.ok(all.length >= 4, 'need at least 4 upcoming events for this test');

    const res = await api('GET', '/events?limit=2&offset=1');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.pagination, { limit: 2, offset: 1, total: all.length });
    assert.deepEqual(res.body.data.map((e) => e.id), all.slice(1, 3).map((e) => e.id));

    const beyond = await api('GET', `/events?offset=${all.length + 10}`);
    assert.equal(beyond.status, 200);
    assert.deepEqual(beyond.body.data, []);
  });

  for (const query of ['limit=0', 'limit=101', 'limit=abc', 'limit=1.5', 'offset=-1', 'offset=abc']) {
    test(`rejects invalid pagination: ?${query} -> 400`, async () => {
      const res = await api('GET', `/events?${query}`);
      assert.equal(res.status, 400);
      assert.equal(typeof res.body?.error, 'string', 'error responses have an "error" message');
    });
  }
});

describe('Part 1: GET /events/:id', () => {
  let eventId;
  let pastEventId;

  before(async () => {
    const user = await createUser();
    eventId = await createEvent({ title: 'Single event', capacity: 12, startsInHours: 30 });
    await createBooking({ eventId, userId: user, seats: 4 });
    await createBooking({ eventId, userId: user, seats: 5, status: 'cancelled' });
    pastEventId = await createEvent({ title: 'Single past event', capacity: 3, startsInHours: -2 });
  });

  test('returns the event with seats_remaining', async () => {
    const res = await api('GET', `/events/${eventId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, eventId);
    assert.equal(res.body.venue, 'Test Venue');
    assert.equal(res.body.capacity, 12);
    assert.equal(res.body.seats_remaining, 8);
    assert.ok(isIsoTimestamp(res.body.starts_at), `starts_at should be an ISO 8601 string, got ${res.body.starts_at}`);
  });

  test('past events can be fetched by id', async () => {
    const res = await api('GET', `/events/${pastEventId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, pastEventId);
    assert.equal(res.body.seats_remaining, 3);
  });

  test('returns 404 for an event that does not exist', async () => {
    const res = await api('GET', `/events/${await missingId('events')}`);
    assert.equal(res.status, 404);
    assert.equal(typeof res.body?.error, 'string');
  });

  for (const badId of ['abc', '0', '-1', '1.5']) {
    test(`returns 400 for an invalid id: /events/${badId}`, async () => {
      const res = await api('GET', `/events/${badId}`);
      assert.equal(res.status, 400);
      assert.equal(typeof res.body?.error, 'string');
    });
  }
});
