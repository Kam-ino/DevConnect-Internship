import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: process.env.BASE_URL || 'http://localhost:3000' },
    n: { type: 'string', default: '100' },
  },
});
const base = values.url.replace(/\/$/, '');
const n = Number(values.n);

const { events } = await (await fetch(`${base}/events`)).json();
const stats = await (await fetch(`${base}/stats`)).json();
console.log(`Data: ${stats.events} events, ${stats.seats} seats, ${stats.orders} orders (${stats.total} rows)`);

const total = [];
const db = [];
let seatsReturned = 0;
for (let i = 0; i < n; i++) {
  const event = events[i % events.length];
  const started = performance.now();
  const res = await fetch(`${base}/events/${event.id}/seats/free`);
  const body = await res.json();
  total.push(performance.now() - started);
  db.push(Number((res.headers.get('server-timing') || '').split('dur=')[1]));
  seatsReturned += body.freeCount;
}

const pct = (arr, p) => [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))];
const fmt = (ms) => `${ms.toFixed(1)} ms`;
console.log(`GET /events/:id/seats/free x ${n} (about ${Math.round(seatsReturned / n)} seats per response)`);
console.log(`  round trip  p50 ${fmt(pct(total, 0.5))}   p95 ${fmt(pct(total, 0.95))}   max ${fmt(Math.max(...total))}`);
console.log(`  server/db   p50 ${fmt(pct(db, 0.5))}   p95 ${fmt(pct(db, 0.95))}   max ${fmt(Math.max(...db))}`);
