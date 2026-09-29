import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { seedIfEmpty, SEED } from '../src/seed.js';

let db;
before(() => {
  db = openDb(':memory:');
  seedIfEmpty(db);
});
after(() => db.close());

describe('schema', () => {
  it('has three related tables linked by foreign keys', () => {
    const fk = (table) => db.prepare(`PRAGMA foreign_key_list(${table})`).all()
      .map((r) => `${table}.${r.from} -> ${r.table}.${r.to}`);
    assert.deepEqual(fk('seats'), ['seats.event_id -> events.id']);
    assert.deepEqual(fk('orders'), ['orders.seat_id -> seats.id']);
  });

  it('enforces foreign keys', () => {
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.throws(
      () => db.prepare("INSERT INTO orders (seat_id, customer, created_at) VALUES (999999, 'x', 'now')").run(),
      /FOREIGN KEY constraint failed/,
    );
    assert.throws(
      () => db.prepare("INSERT INTO seats (event_id, section, row_label, seat_number, price_cents) VALUES (999, 'A', 'A', 1, 0)").run(),
      /FOREIGN KEY constraint failed/,
    );
  });

  it('refuses a second order for the same seat at the database level', () => {
    const { id } = db.prepare('SELECT id FROM seats WHERE id NOT IN (SELECT seat_id FROM orders) LIMIT 1').get();
    const insert = db.prepare("INSERT INTO orders (seat_id, customer, created_at) VALUES (?, ?, 'now')");
    insert.run(id, 'first');
    assert.throws(() => insert.run(id, 'second'), /UNIQUE constraint failed: orders\.seat_id/);
  });
});

describe('seed', () => {
  it('creates at least 10,000 seats across several events', () => {
    const { events, seats, orders } = db.prepare(
      'SELECT (SELECT COUNT(*) FROM events) events, (SELECT COUNT(*) FROM seats) seats, (SELECT COUNT(*) FROM orders) orders',
    ).get();
    assert.equal(events, SEED.events.length);
    assert.ok(events >= 3);
    assert.ok(seats >= 10000, `only ${seats} seats`);
    assert.ok(orders > 0 && orders < seats);
  });

  it('is idempotent', () => {
    assert.equal(seedIfEmpty(db), null);
  });
});
