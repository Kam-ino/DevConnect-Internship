export const SEED = {
  events: [
    { name: 'Midnight Jazz Session', venue: 'Riverside Arena', startsAt: '2026-11-07T20:00:00+08:00' },
    { name: 'Indie Rock Showcase', venue: 'Riverside Arena', startsAt: '2026-11-21T19:30:00+08:00' },
    { name: 'Symphony Under the Stars', venue: 'Riverside Arena', startsAt: '2026-12-05T19:00:00+08:00' },
    { name: 'Stand-up Comedy Gala', venue: 'Riverside Arena', startsAt: '2027-01-16T20:00:00+08:00' },
    { name: 'Developer Conference Keynote', venue: 'Riverside Arena', startsAt: '2027-02-13T09:00:00+08:00' },
  ],
  sections: [
    { name: 'A', priceCents: 450000 },
    { name: 'B', priceCents: 320000 },
    { name: 'C', priceCents: 210000 },
    { name: 'D', priceCents: 120000 },
  ],
  rows: 'ABCDEFGHIJKLMNOPQRST'.split(''),
  seatsPerRow: 30,
  reserveEveryNth: 7,
};

export function seedIfEmpty(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM events').get();
  if (n > 0) return null;

  const insertEvent = db.prepare('INSERT INTO events (name, venue, starts_at) VALUES (?, ?, ?) RETURNING id');
  const insertSeat = db.prepare(
    'INSERT INTO seats (event_id, section, row_label, seat_number, price_cents) VALUES (?, ?, ?, ?, ?) RETURNING id',
  );
  const insertOrder = db.prepare('INSERT INTO orders (seat_id, customer, created_at) VALUES (?, ?, ?)');

  let seats = 0;
  let orders = 0;
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    for (const event of SEED.events) {
      const { id: eventId } = insertEvent.get(event.name, event.venue, event.startsAt);
      for (const section of SEED.sections) {
        for (const row of SEED.rows) {
          for (let number = 1; number <= SEED.seatsPerRow; number++) {
            const { id: seatId } = insertSeat.get(eventId, section.name, row, number, section.priceCents);
            seats++;
            if (seatId % SEED.reserveEveryNth === 0) {
              insertOrder.run(seatId, `seed-customer-${seatId}`, now);
              orders++;
            }
          }
        }
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { events: SEED.events.length, seats, orders };
}
