import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    venue      TEXT    NOT NULL,
    starts_at  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS seats (
    id           INTEGER PRIMARY KEY,
    event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    section      TEXT    NOT NULL,
    row_label    TEXT    NOT NULL,
    seat_number  INTEGER NOT NULL CHECK (seat_number > 0),
    price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
    UNIQUE (event_id, section, row_label, seat_number)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id          INTEGER PRIMARY KEY,
    seat_id     INTEGER NOT NULL UNIQUE REFERENCES seats(id) ON DELETE CASCADE,
    customer    TEXT    NOT NULL CHECK (length(customer) BETWEEN 1 AND 100),
    created_at  TEXT    NOT NULL
  );
`;

export function openDb(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
  `);
  db.exec(SCHEMA);
  return db;
}
