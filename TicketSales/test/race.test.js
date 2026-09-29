import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { startCluster } from './helpers.js';

let server;
before(async () => { server = await startCluster({ workers: 4 }); });
after(() => server.close());

const ordersForSeat = (seatId) => {
  const db = new DatabaseSync(server.dbFile, { readOnly: true });
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM orders WHERE seat_id = ?').get(seatId).n;
  } finally {
    db.close();
  }
};

describe('concurrent reservations across 4 server processes', () => {
  it('50 simultaneous requests for one seat: exactly one 201, forty-nine 409s, one row', async () => {
    const { body } = await server.request('GET', '/events/1/seats/free');
    const seat = body.seats[0];
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => server.request('POST', `/events/1/seats/${seat.id}/reservations`, { json: { customer: `buyer-${i}` } })),
    );
    const statuses = results.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 201).length, 1, statuses.join(','));
    assert.equal(statuses.filter((s) => s === 409).length, 49, statuses.join(','));
    const pids = new Set(results.map((r) => r.headers.get('x-served-by')));
    assert.ok(pids.size > 1, `all requests hit one process (${[...pids]})`);
    assert.equal(ordersForSeat(seat.id), 1);
  });

  it('20 different seats, 10 simultaneous requests each: every seat sold exactly once', async () => {
    const { body } = await server.request('GET', '/events/2/seats/free');
    const seats = body.seats.slice(0, 20);
    const results = await Promise.all(
      seats.flatMap((seat) => Array.from({ length: 10 }, (_, i) =>
        server.request('POST', `/events/2/seats/${seat.id}/reservations`, { json: { customer: `c${i}` } })
          .then((r) => ({ seatId: seat.id, status: r.status })))),
    );
    for (const seat of seats) {
      const mine = results.filter((r) => r.seatId === seat.id).map((r) => r.status);
      assert.equal(mine.filter((s) => s === 201).length, 1, `seat ${seat.id}: ${mine}`);
      assert.equal(mine.filter((s) => s === 409).length, 9, `seat ${seat.id}: ${mine}`);
      assert.equal(ordersForSeat(seat.id), 1);
    }
  });
});
