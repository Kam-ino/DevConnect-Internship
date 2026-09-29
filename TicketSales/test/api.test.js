import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startInProcess } from './helpers.js';

let api;
before(async () => { api = await startInProcess(); });
after(() => api.close());

const firstFreeSeat = async (eventId = 1) => (await api.request('GET', `/events/${eventId}/seats/free`)).body.seats[0];
const reserve = (eventId, seatId, json = { customer: 'alice' }) =>
  api.request('POST', `/events/${eventId}/seats/${seatId}/reservations`, { json });

describe('listing free seats', () => {
  it('lists events with seat counts', async () => {
    const res = await api.request('GET', '/events');
    assert.equal(res.status, 200);
    assert.equal(res.body.events.length, 5);
    for (const e of res.body.events) assert.ok(e.freeSeats < e.totalSeats);
  });

  it('returns only seats without an order', async () => {
    const res = await api.request('GET', '/events/1/seats/free');
    assert.equal(res.status, 200);
    const reserved = api.db.prepare(
      'SELECT COUNT(*) n FROM orders o JOIN seats s ON s.id = o.seat_id WHERE s.event_id = 1',
    ).get().n;
    const total = api.db.prepare('SELECT COUNT(*) n FROM seats WHERE event_id = 1').get().n;
    assert.equal(res.body.freeCount, total - reserved);
    assert.equal(res.body.seats.length, res.body.freeCount);
    const taken = new Set(api.db.prepare('SELECT seat_id FROM orders').all().map((r) => r.seat_id));
    assert.ok(res.body.seats.every((s) => !taken.has(s.id)));
    assert.match(res.headers.get('server-timing'), /^db;dur=/);
  });

  it('responds in under 200 ms', async () => {
    const times = [];
    for (let i = 0; i < 25; i++) times.push((await api.request('GET', `/events/${(i % 5) + 1}/seats/free`)).ms);
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95) - 1];
    assert.ok(p95 < 200, `p95 was ${p95.toFixed(1)} ms`);
  });

  it('404 for an unknown event, 400 for a bad id', async () => {
    assert.equal((await api.request('GET', '/events/999/seats/free')).status, 404);
    const bad = await api.request('GET', '/events/abc/seats/free');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.field, 'eventId');
  });
});

describe('reserving a seat', () => {
  it('201 the first time, 409 the second time, and the seat leaves the free list', async () => {
    const seat = await firstFreeSeat(1);
    const first = await reserve(1, seat.id, { customer: 'alice' });
    assert.equal(first.status, 201);
    assert.equal(first.headers.get('location'), `/orders/${first.body.id}`);
    assert.equal(first.body.seatId, seat.id);

    const second = await reserve(1, seat.id, { customer: 'bob' });
    assert.equal(second.status, 409);
    assert.equal(second.body.field, 'seatId');

    const free = await api.request('GET', '/events/1/seats/free');
    assert.ok(!free.body.seats.some((s) => s.id === seat.id));

    const status = await api.request('GET', `/events/1/seats/${seat.id}`);
    assert.equal(status.body.reserved, true);

    const order = await api.request('GET', `/orders/${first.body.id}`);
    assert.equal(order.status, 200);
    assert.equal(order.body.customer, 'alice');
  });

  it('two requests fired together in one process: exactly one wins', async () => {
    const seat = await firstFreeSeat(2);
    const results = await Promise.all([reserve(2, seat.id, { customer: 'a' }), reserve(2, seat.id, { customer: 'b' })]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  });

  it('404 when the seat belongs to a different event', async () => {
    const seatOfEvent3 = await firstFreeSeat(3);
    const res = await reserve(1, seatOfEvent3.id);
    assert.equal(res.status, 404);
    assert.equal(res.body.field, 'seatId');
  });

  it('400 naming the field for bad input', async () => {
    const seat = await firstFreeSeat(4);
    const cases = [
      [{}, 'customer'],
      [{ customer: '' }, 'customer'],
      [{ customer: '   ' }, 'customer'],
      [{ customer: 42 }, 'customer'],
      [{ customer: 'x'.repeat(101) }, 'customer'],
    ];
    for (const [json, field] of cases) {
      const res = await reserve(4, seat.id, json);
      assert.equal(res.status, 400, JSON.stringify(json));
      assert.equal(res.body.field, field);
    }
    const badJson = await api.request('POST', `/events/4/seats/${seat.id}/reservations`, { raw: '{"customer":', contentType: 'application/json' });
    assert.equal(badJson.status, 400);
    assert.equal(badJson.body.field, 'body');
    assert.equal((await reserve(4, 'abc')).body.field, 'seatId');
    assert.equal((await api.request('GET', `/events/4/seats/${seat.id}`)).body.reserved, false);
  });
});

describe('demo page', () => {
  it('serves the page, health, stats and README', async () => {
    const page = await fetch(api.base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Ticket Sales/);
    assert.equal((await api.request('GET', '/health')).status, 200);
    const stats = await api.request('GET', '/stats');
    assert.ok(stats.body.seats >= 10000);
    assert.equal((await fetch(api.base + '/README.md')).status, 200);
    assert.equal((await fetch(api.base + '/package.json')).status, 404);
  });
});
