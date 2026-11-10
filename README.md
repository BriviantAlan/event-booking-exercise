# Event Booking API — Backend Exercise

Welcome! In this exercise you'll build a small REST API on top of a MySQL
database. A local organiser runs free tech talks. Each event has a limited
number of seats, and users can book (and cancel) seats.

The project already runs: a MySQL database with sample data, and a Node.js +
Express API with one example endpoint. Your job is to add the endpoints
described below.

**Expected time:** about 90 minutes. Parts 1 and 2 are the core of the
exercise. Part 3 is a stretch goal, so don't worry if you don't finish it.
We care more about correct, readable code than about finishing everything.

---

## 1. Getting started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker
  Engine with the Compose v2 plugin)
- Git
- Node.js is **not** required on your machine. Everything runs in containers.

### Run it

```bash
git clone <this-repo-url> event-booking-exercise
cd event-booking-exercise
docker compose up --build
```

The first run downloads the MySQL and Node images, which takes a minute or
two. When you see `API listening on http://localhost:3000`, check that it
works:

```bash
curl http://localhost:3000/health
# {"status":"ok","database":"ok"}

curl http://localhost:3000/users/1
# {"id":1,"name":"Maya Patel","email":"maya.patel@example.com","created_at":"..."}
```

The API restarts automatically when you save a file in `src/`, so you don't
need to rebuild while you work.

### Useful commands

| What | Command |
| --- | --- |
| Start everything | `docker compose up --build` |
| Stop everything | `docker compose down` |
| View API logs | `docker compose logs -f api` |
| Open a MySQL shell | `docker compose exec db mysql -uapp -papp interview` |
| Run all tests | `docker compose exec api npm test` |
| Run one part's tests | `docker compose exec api npm run test:part1` (or `part2`, `part3`) |
| Reset the database to the original seed data | `docker compose down -v && docker compose up --build` |

Ports used: **3000** (API) and **3307** (MySQL, so it doesn't clash with a
MySQL you may already have on 3306). If either port is already taken on your
machine, pick others when you start, for example
`API_PORT=3100 DB_HOST_PORT=3308 docker compose up --build`.

You can connect a GUI client like TablePlus or DBeaver to `127.0.0.1:3307`
with user `app`, password `app`, database `interview`.

---

## 2. Project layout

```
.
├── docker-compose.yml   # MySQL + API containers
├── Dockerfile           # API container image
├── db/
│   ├── schema.sql       # Tables (loaded on the database's first start)
│   └── seed.sql         # Sample data
├── src/
│   ├── server.js        # Entry point
│   ├── app.js           # Express app, routing, error handling
│   ├── db.js            # MySQL connection pool (mysql2/promise)
│   └── routes/
│       ├── users.js     # GET /users/:id is implemented as an example
│       ├── events.js    # TODO: Parts 1 and 2
│       └── bookings.js  # TODO: Part 3
├── test/                # Automated tests that call the running API over HTTP
└── NOTES.md             # Your written answers (Part 4)
```

You can restructure `src/` however you like and add any npm packages you want.
If you add a package, update `package.json` and run
`docker compose up --build`.

---

## 3. Data model

```
users                 events                    bookings
-----                 ------                    --------
id          PK        id          PK            id            PK
name                  title                     event_id      FK -> events.id
email       unique    venue                     user_id       FK -> users.id
created_at            starts_at   (UTC)         seats
                      capacity                  status        'confirmed' | 'cancelled'
                      created_at                created_at
                                                cancelled_at  (NULL unless cancelled)
```

The full definition is in [`db/schema.sql`](db/schema.sql).

**Key rule:** an event's seats taken is the sum of `seats` across its
**confirmed** bookings. Cancelled bookings don't count.

```
seats_remaining = capacity - SUM(seats of confirmed bookings)
```

You may add indexes, columns or tables. Please don't rename or remove
existing columns, because the tests insert rows directly into these tables.

---

## 4. Your tasks

### API conventions (apply to every endpoint)

- Requests and responses are JSON.
- Timestamps are returned as ISO 8601 strings in UTC, for example
  `"2026-12-01T18:00:00.000Z"`.
- IDs in the URL must be positive integers. Anything else (`/events/abc`,
  `/events/0`) returns **400**.
- Errors use this shape, with a helpful message:
  ```json
  { "error": "seats must be an integer between 1 and 10" }
  ```

| Status | When |
| --- | --- |
| `200 OK` / `201 Created` | Success |
| `400 Bad Request` | Invalid input (bad ID, missing or invalid fields, bad query parameters) |
| `404 Not Found` | The resource in the URL doesn't exist |
| `409 Conflict` | The request is valid but conflicts with the current state (sold out, already cancelled, etc.) |
| `500 Internal Server Error` | Unexpected errors only. Never for bad input. |

An **Event** object looks like this:

```json
{
  "id": 1,
  "title": "Intro to SQL Indexing",
  "venue": "Room 101",
  "starts_at": "2026-12-01T18:00:00.000Z",
  "capacity": 30,
  "seats_remaining": 27
}
```

A **Booking** object looks like this:

```json
{
  "id": 42,
  "event_id": 1,
  "user_id": 3,
  "seats": 2,
  "status": "confirmed",
  "created_at": "2026-11-10T09:15:00.000Z",
  "cancelled_at": null
}
```

---

### Part 1: Browse events

#### `GET /events`

Lists **upcoming** events, meaning `starts_at` is in the future.

- Sorted by `starts_at` ascending, with ties broken by `id` ascending.
- Each item is an Event object, including `seats_remaining`.
- Pagination through query parameters:
  - `limit`: integer 1–100, default `20`
  - `offset`: integer ≥ 0, default `0`
  - Invalid values return **400**.

Response `200`:

```json
{
  "data": [ { "id": 1, "title": "...", "...": "..." } ],
  "pagination": { "limit": 20, "offset": 0, "total": 11 }
}
```

`total` is the total number of upcoming events, not the number in this page.

#### `GET /events/:id`

Returns a single Event object. Past events can be fetched too.

- `404` if the event doesn't exist.

---

### Part 2: Book seats

#### `POST /events/:id/bookings`

Request body:

```json
{ "user_id": 3, "seats": 2 }
```

Rules:

| Check | Response |
| --- | --- |
| `user_id` is missing or not a positive integer | `400` |
| `seats` is missing or not an integer from 1 to 10 | `400` |
| The user doesn't exist | `400` |
| The event doesn't exist | `404` |
| The event has already started (`starts_at` is now or in the past) | `409` |
| Not enough seats remaining for the requested amount | `409` |
| Otherwise, create a confirmed booking | `201` with the Booking object |

> ⚠️ **The important part:** many people book popular events at the same
> moment. Your implementation must **never** confirm more seats than an
> event's capacity, even when many requests arrive at the same time. The tests
> include a check that sends 25 simultaneous requests for an event with 5
> seats.

---

### Part 3 (stretch): Manage bookings

#### `GET /users/:id/bookings`

Lists all of a user's bookings (confirmed and cancelled), newest first
(by `created_at` descending, then `id` descending). Each item is a Booking
object with a summary of its event:

```json
{
  "data": [
    {
      "id": 42,
      "event_id": 1,
      "user_id": 3,
      "seats": 2,
      "status": "confirmed",
      "created_at": "2026-11-10T09:15:00.000Z",
      "cancelled_at": null,
      "event": { "id": 1, "title": "Intro to SQL Indexing", "starts_at": "2026-12-01T18:00:00.000Z" }
    }
  ]
}
```

- `404` if the user doesn't exist. Return an empty `data` array if the user
  exists but has no bookings.

#### `POST /bookings/:id/cancel`

Cancels a booking. Its seats become available again.

- `200` with the updated Booking object (`status: "cancelled"`, `cancelled_at`
  set).
- `404` if the booking doesn't exist.
- `409` if the booking is already cancelled.

---

### Part 4: Notes

Answer the questions in [`NOTES.md`](NOTES.md). A few sentences each is plenty.

---

## 5. Testing

The tests in `test/` call your API over HTTP and set up their own data in the
database, then remove it when they finish. They don't change the seed data.

```bash
docker compose exec api npm test            # everything
docker compose exec api npm run test:part1  # just Part 1
```

Every test fails at first, because the endpoints return `501 Not Implemented`.
Passing tests are a good sign, but we will also read your code. Feel free to
add your own tests.

**Using a different language?** That's fine. Replace the `api` service in
`docker-compose.yml` with your own and keep it on port 3000. You can still run
the tests from your machine with Node.js 20+: `npm install && npm test`. They
connect to `localhost:3000` and to MySQL on `127.0.0.1:3307`.

---

## 6. Submitting

1. Commit your work. Small, focused commits are a plus.
2. Fill in `NOTES.md`.
3. Share your repository (or a zip of it, **without** `node_modules`) as your
   interviewer asked.

Questions? Ask your interviewer. If something is ambiguous, make a reasonable
choice and write it down in `NOTES.md`. That's a perfectly good answer.

Good luck, and have fun! 🎟️
