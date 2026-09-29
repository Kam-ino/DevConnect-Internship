import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: process.env.BASE_URL || 'http://localhost:3000' },
    event: { type: 'string', default: '1' },
    seat: { type: 'string' },
    n: { type: 'string', default: '50' },
  },
});

const base = values.url.replace(/\/$/, '');
const eventId = Number(values.event);
const n = Number(values.n);

async function json(res) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

let seatId = values.seat ? Number(values.seat) : null;
if (!seatId) {
  const free = await json(await fetch(`${base}/events/${eventId}/seats/free`));
  if (!free || !free.seats || free.seats.length === 0) {
    console.error(`No free seats for event ${eventId}`);
    process.exit(1);
  }
  seatId = free.seats[0].id;
}

const seat = await json(await fetch(`${base}/events/${eventId}/seats/${seatId}`));
console.log(`Seat ${seatId} (event ${eventId}, section ${seat.section}, row ${seat.row}, seat ${seat.number}), reserved before: ${seat.reserved}`);
console.log(`Firing ${n} reservation requests at the same moment...\n`);

const requests = Array.from({ length: n }, (_, i) =>
  fetch(`${base}/events/${eventId}/seats/${seatId}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer: `buyer-${i + 1}` }),
  }).then(async (res) => ({ i: i + 1, status: res.status, pid: res.headers.get('x-served-by'), body: await json(res) })),
);
const results = await Promise.all(requests);

for (const r of results) {
  const detail = r.status === 201 ? `order ${r.body.id}` : r.body.error;
  console.log(`  buyer-${String(r.i).padEnd(3)} ${r.status}  pid ${r.pid}  ${detail}`);
}

const count = (status) => results.filter((r) => r.status === status).length;
const pids = new Set(results.map((r) => r.pid));
const after = await json(await fetch(`${base}/events/${eventId}/seats/${seatId}`));
console.log(`\nResult: ${count(201)} x 201 Created, ${count(409)} x 409 Conflict, ${n - count(201) - count(409)} other`);
console.log(`Handled by ${pids.size} server process(es): ${[...pids].join(', ')}`);
console.log(`Seat ${seatId} reserved after: ${after.reserved}`);
process.exit(count(201) === 1 ? 0 : 1);
