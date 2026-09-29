const SQLITE_CONSTRAINT_UNIQUE = 2067;

const toEvent = (row) => ({
  id: row.id,
  name: row.name,
  venue: row.venue,
  startsAt: row.starts_at,
  ...(row.total_seats !== undefined && { totalSeats: row.total_seats, freeSeats: row.free_seats }),
});

const toSeat = (row) => ({
  id: row.id,
  section: row.section,
  row: row.row_label,
  number: row.seat_number,
  priceCents: row.price_cents,
});

const toOrder = (row) => ({
  id: row.id,
  eventId: row.event_id,
  seatId: row.seat_id,
  customer: row.customer,
  createdAt: row.created_at,
});

export function createStore(db) {
  const q = {
    listEvents: db.prepare(`
      SELECT e.id, e.name, e.venue, e.starts_at,
             COUNT(s.id) AS total_seats,
             COUNT(s.id) - COUNT(o.id) AS free_seats
        FROM events e
        JOIN seats s ON s.event_id = e.id
        LEFT JOIN orders o ON o.seat_id = s.id
       GROUP BY e.id
       ORDER BY e.starts_at
    `),
    getEvent: db.prepare('SELECT id, name, venue, starts_at FROM events WHERE id = ?'),
    freeSeats: db.prepare(`
      SELECT s.id, s.section, s.row_label, s.seat_number, s.price_cents
        FROM seats s
       WHERE s.event_id = ?
         AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.seat_id = s.id)
       ORDER BY s.section, s.row_label, s.seat_number
    `),
    getSeat: db.prepare(`
      SELECT s.id, s.section, s.row_label, s.seat_number, s.price_cents, o.id AS order_id
        FROM seats s
        LEFT JOIN orders o ON o.seat_id = s.id
       WHERE s.id = ? AND s.event_id = ?
    `),
    insertOrder: db.prepare(`
      INSERT INTO orders (seat_id, customer, created_at)
      VALUES (?, ?, ?)
      RETURNING id, seat_id, customer, created_at
    `),
    getOrder: db.prepare(`
      SELECT o.id, o.seat_id, o.customer, o.created_at, s.event_id
        FROM orders o
        JOIN seats s ON s.id = o.seat_id
       WHERE o.id = ?
    `),
    stats: db.prepare(`
      SELECT (SELECT COUNT(*) FROM events) AS events,
             (SELECT COUNT(*) FROM seats)  AS seats,
             (SELECT COUNT(*) FROM orders) AS orders
    `),
  };

  return {
    listEvents: () => q.listEvents.all().map(toEvent),

    getEvent(eventId) {
      const row = q.getEvent.get(eventId);
      return row ? toEvent(row) : null;
    },

    freeSeats: (eventId) => q.freeSeats.all(eventId).map(toSeat),

    getSeat(eventId, seatId) {
      const row = q.getSeat.get(seatId, eventId);
      if (!row) return null;
      return { ...toSeat(row), eventId, reserved: row.order_id !== null };
    },

    reserve(eventId, seatId, customer) {
      if (!q.getSeat.get(seatId, eventId)) return { error: 'seat_not_found' };
      try {
        const row = q.insertOrder.get(seatId, customer, new Date().toISOString());
        return { order: toOrder({ ...row, event_id: eventId }) };
      } catch (err) {
        if (err.errcode === SQLITE_CONSTRAINT_UNIQUE && /orders\.seat_id/.test(err.message)) {
          return { error: 'seat_taken' };
        }
        throw err;
      }
    },

    getOrder(orderId) {
      const row = q.getOrder.get(orderId);
      return row ? toOrder(row) : null;
    },

    stats() {
      const row = q.stats.get();
      return { events: row.events, seats: row.seats, orders: row.orders, total: row.events + row.seats + row.orders };
    },
  };
}
