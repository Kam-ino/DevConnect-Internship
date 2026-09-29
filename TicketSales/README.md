# Ticket Sales

An HTTP service for selling seats to events. You can list the free seats for an event and reserve a specific seat.

The point of the exercise: **two requests for the same seat can never both succeed**. This README shows that with real commands and their real output, not just a claim.

**Live demo:** https://YOUR-SERVICE.onrender.com. Pick a seat, or press **Fire simultaneous reservations** to race 20 buyers for one seat.

**Stack:** Node.js 22.13+ · Express 5 · SQLite via the built-in `node:sqlite` module · the server runs as several worker processes (`node:cluster`) sharing one database file.

## Running it

```bash
npm install
npm start            # http://localhost:3000, 4 worker processes, seeds tickets.db on first run
npm test             # 16 tests, including a 50-request race across 4 processes
npm run race         # fire 50 simultaneous reservations at one seat
npm run bench        # time the free-seat listing
```

Environment variables: `PORT` (default `3000`), `DB_FILE` (default `tickets.db`), `WORKERS` (default `4`).

## Data model

Three tables, linked by foreign keys:

```
events 1 ──< seats 1 ──o orders
```

| Table | Columns | Keys and constraints |
|---|---|---|
| `events` | `id`, `name`, `venue`, `starts_at` | primary key `id` |
| `seats` | `id`, `event_id`, `section`, `row_label`, `seat_number`, `price_cents` | `event_id` → `events.id` (FK) · `UNIQUE (event_id, section, row_label, seat_number)` |
| `orders` | `id`, `seat_id`, `customer`, `created_at` | `seat_id` → `seats.id` (FK) · **`UNIQUE (seat_id)`** |

A seat is **free** when no order points at it. There is no separate "status" column that could get out of sync with the orders table.

SQLite only enforces foreign keys when a connection runs `PRAGMA foreign_keys = ON`, so `openDb()` runs it on every connection. A test checks that an order for a seat that doesn't exist is rejected.

## Seed data

On first start the server seeds the database:

| | Count |
|---|---|
| Events | 5 |
| Seats | **12,000** (5 events × 4 sections × 20 rows × 30 seats) |
| Orders | 1,714 (every 7th seat is pre-sold, so the free list has gaps) |
| **Total rows** | **13,719** |

Seeding runs in one transaction and is skipped if events already exist. You can see the live counts at `GET /stats`.

## Endpoints

| Method | Path | Success | Other responses |
|---|---|---|---|
| `GET` | `/events` | **200** events with `totalSeats` and `freeSeats` | |
| `GET` | `/events/:eventId/seats/free` | **200** `{ eventId, freeCount, seats: [...] }` | `400` bad id · `404` no such event |
| `POST` | `/events/:eventId/seats/:seatId/reservations` with body `{"customer": "Kamino"}` | **201** the new order, with a `Location` header | **`409` seat already reserved** · `404` seat not in this event · `400` bad input · `503` database busy (retry) |
| `GET` | `/events/:eventId/seats/:seatId` | **200** the seat, with `"reserved": true/false` | `404` |
| `GET` | `/orders/:orderId` | **200** the order | `404` |

Every error has the form `{ "error": "…", "field": "…" }`. Every response has an `X-Served-By` header with the process id that handled it, which shows that concurrent requests really are handled by different processes.

## How double booking is prevented

**The database refuses the second order.** `orders.seat_id` is `UNIQUE`, and reserving a seat is a single `INSERT`:

```sql
INSERT INTO orders (seat_id, customer, created_at) VALUES (?, ?, ?) RETURNING ...
```

If two requests race, SQLite serializes the two writes. The first insert commits. The second fails with `UNIQUE constraint failed: orders.seat_id` (SQLite error code 2067), and the API turns that into **409 Conflict**. There is no window in which both can succeed, whatever the timing and however many processes or servers are running.

**Why not "check if the seat is free, then insert"?** Two requests can both run the check before either one inserts, so both see "free" and both sell the seat. That window is often tiny, so it rarely shows up in testing. That's exactly why testing alone can't prove it is safe, while a constraint can.

**Why not a lock in JavaScript?** A mutex only protects one process. This server runs 4 worker processes, and a real deployment could run several machines. Only the database sees every request, so that is where the rule has to live.

## Demonstration: two concurrent reservations of one seat

Run against a local server started with `npm start` (4 worker processes). Seat 100 is section A, row D, seat 10 of event 1, and it was free.

**The two commands**, started at the same time with `&` and waited on together:

```bash
curl -s -w '  -> HTTP %{http_code}, served by pid %header{x-served-by}\n' \
  -X POST localhost:3000/events/1/seats/100/reservations \
  -H 'Content-Type: application/json' -d '{"customer":"Kamino"}' &
curl -s -w '  -> HTTP %{http_code}, served by pid %header{x-served-by}\n' \
  -X POST localhost:3000/events/1/seats/100/reservations \
  -H 'Content-Type: application/json' -d '{"customer":"bob"}' &
wait
```

**What came back:**

```
{"id":1715,"eventId":1,"seatId":100,"customer":"bob","createdAt":"2026-09-29T11:45:22.249Z"}  -> HTTP 201, served by pid 438
{"error":"seat is already reserved","field":"seatId"}  -> HTTP 409, served by pid 439
```

The two requests were handled by **two different processes** (438 and 439). One got `201`, the other got `409`.

**Checking the result:**

```bash
$ curl -s localhost:3000/events/1/seats/100
{"id":100,"section":"A","row":"D","number":10,"priceCents":450000,"eventId":1,"reserved":true}

$ curl -s localhost:3000/orders/1715
{"id":1715,"eventId":1,"seatId":100,"customer":"bob","createdAt":"2026-09-29T11:45:22.249Z"}
```

Counting rows in the database directly: seat 100 has exactly **1** order.

### Stronger version: 50 buyers, one seat

```bash
$ npm run race -- --event 2 --seat 2500 --n 50

Seat 2500 (event 2, section A, row D, seat 10), reserved before: false
Firing 50 reservation requests at the same moment...

  buyer-1   201  pid 408  order 1716
  buyer-2   409  pid 415  seat is already reserved
  buyer-3   409  pid 407  seat is already reserved
  buyer-4   409  pid 414  seat is already reserved
  ...
  buyer-50  409  pid 407  seat is already reserved

Result: 1 x 201 Created, 49 x 409 Conflict, 0 other
Handled by 4 server process(es): 408, 415, 407, 414
Seat 2500 reserved after: true
```

The script exits with code 1 if anything other than exactly one request succeeds.

### Automated

`test/race.test.js` starts the real server with 4 worker processes on a temporary database. It then checks two things:

- 50 simultaneous requests for one seat produce exactly one `201`, forty-nine `409`s, requests handled by more than one process, and exactly one row in `orders` (counted by opening the database file directly).
- 20 seats with 10 simultaneous buyers each: every seat is sold exactly once.

`test/schema.test.js` also inserts a duplicate order straight into SQLite and checks that the `UNIQUE` constraint rejects it.

## Performance: listing free seats

Each event has 2,400 seats, and about 2,057 of them are free, so each response carries about 2,000 seats (138 KB of JSON).

```
$ npm run bench
Data: 5 events, 12000 seats, 1716 orders (13721 rows)
GET /events/:id/seats/free x 100 (about 2057 seats per response)
  round trip  p50 9.8 ms   p95 14.7 ms   max 21.4 ms
  server/db   p50 5.1 ms   p95 7.0 ms   max 8.5 ms

$ curl -s -o /dev/null -w '%{http_code} %{size_download} bytes %{time_total}s\n' localhost:3000/events/1/seats/free
200 138349 bytes 0.008149s
```

That's well under 200 ms. Two indexes make it fast:

- `UNIQUE (event_id, section, row_label, seat_number)` on `seats` finds one event's seats and returns them already sorted.
- `UNIQUE (seat_id)` on `orders` makes the `NOT EXISTS (SELECT 1 FROM orders WHERE seat_id = s.id)` check a single index lookup per seat.

Every free-seat response has a `Server-Timing: db;dur=…` header, and the demo page shows it next to the round-trip time. `test/api.test.js` fails if the p95 round trip reaches 200 ms.

## Deploying (Render, free tier)

1. Push the repo to GitHub.
2. On [render.com](https://render.com), click **New → Web Service** and connect the repo.
3. Use these settings:

   | Setting | Value |
   |---|---|
   | Root Directory | `TicketSales` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | Free |
   | Health Check Path | `/health` |

The free tier sleeps after 15 minutes without traffic, and waking up takes about a minute. The disk is also wiped on restart, so the database is re-seeded each time. That's fine for a demo.

## Project layout

```
src/
  server.js      starts the worker processes (node:cluster); seeds once in the primary
  app.js         routes and status codes
  store.js       all SQL; reserve() turns a UNIQUE violation into 409
  db.js          schema, foreign keys, pragmas
  seed.js        5 events x 2,400 seats
  validate.js    ids and request body
public/
  index.html     live demo page: seat map, reserve, race test
scripts/
  race.js        n simultaneous reservations for one seat
  bench.js       free-seat listing latency
test/
  schema.test.js, api.test.js, race.test.js
```
