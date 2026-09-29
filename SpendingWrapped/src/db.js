import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY,
    email          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash  TEXT    NOT NULL,
    created_at     TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS imports (
    id                   INTEGER PRIMARY KEY,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    idempotency_key      TEXT,
    content_hash         TEXT    NOT NULL,
    filename             TEXT    NOT NULL,
    csv                  TEXT    NOT NULL,
    status               TEXT    NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed')),
    total_rows           INTEGER NOT NULL,
    processed_rows       INTEGER NOT NULL DEFAULT 0,
    new_rows             INTEGER NOT NULL DEFAULT 0,
    duplicate_rows       INTEGER NOT NULL DEFAULT 0,
    invalid_rows         INTEGER NOT NULL DEFAULT 0,
    row_errors           TEXT    NOT NULL DEFAULT '[]',
    attempts             INTEGER NOT NULL DEFAULT 0,
    run_count            INTEGER NOT NULL DEFAULT 1,
    lease_owner          TEXT,
    lease_expires_at     INTEGER,
    last_error           TEXT,
    summary_fingerprint  TEXT,
    created_at           TEXT    NOT NULL,
    started_at           TEXT,
    finished_at          TEXT,
    UNIQUE (user_id, idempotency_key)
  );
  CREATE INDEX IF NOT EXISTS imports_claim_idx ON imports (status, lease_expires_at);
  CREATE INDEX IF NOT EXISTS imports_user_idx ON imports (user_id, id);

  CREATE TABLE IF NOT EXISTS import_events (
    id         INTEGER PRIMARY KEY,
    import_id  INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    at         TEXT    NOT NULL,
    kind       TEXT    NOT NULL,
    detail     TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS import_events_idx ON import_events (import_id, id);

  CREATE TABLE IF NOT EXISTS transactions (
    id            INTEGER PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    import_id     INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    row_key       TEXT    NOT NULL,
    date          TEXT    NOT NULL,
    merchant      TEXT    NOT NULL,
    category      TEXT    NOT NULL,
    amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
    UNIQUE (user_id, row_key)
  );
  CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions (user_id, date);

  CREATE TABLE IF NOT EXISTS summaries (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year         INTEGER NOT NULL,
    data         TEXT    NOT NULL,
    fingerprint  TEXT    NOT NULL,
    built_at     TEXT    NOT NULL,
    PRIMARY KEY (user_id, year)
  );
`;

export function openDb(filename) {
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

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw err;
  }
}
