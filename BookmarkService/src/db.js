import { DatabaseSync } from 'node:sqlite';

export function openDb(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT    NOT NULL,
      url            TEXT    NOT NULL,
      normalized_url TEXT    NOT NULL,
      title          TEXT,
      created_at     TEXT    NOT NULL,
      UNIQUE (user_id, normalized_url)
    );
  `);
  return db;
}
