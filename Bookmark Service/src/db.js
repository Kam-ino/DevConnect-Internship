import { DatabaseSync } from 'node:sqlite';

/**
 * Open (and if needed create) the bookmarks database.
 * Pass ':memory:' for a throwaway database, which is what the tests do.
 */
export function openDb(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        TEXT    NOT NULL,
      url            TEXT    NOT NULL,  -- exactly what the caller first sent (trimmed)
      normalized_url TEXT    NOT NULL,  -- canonical form, used only to detect repeats
      title          TEXT,
      created_at     TEXT    NOT NULL,
      -- The database itself refuses a second row for the same user + URL.
      -- This is what makes "same request twice = one row" hold even when two
      -- requests race each other; a check-then-insert in JS would not.
      UNIQUE (user_id, normalized_url)
    );
  `);
  return db;
}
