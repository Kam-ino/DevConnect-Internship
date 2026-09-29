/**
 * All SQL lives here so the route handlers only deal with plain objects.
 * Every query is scoped by user_id: a caller can never see or delete
 * another caller's bookmarks.
 */

const toBookmark = (row) => ({
  id: Number(row.id),
  url: row.url,
  title: row.title,
  createdAt: row.created_at,
});

export function createStore(db) {
  const insert = db.prepare(`
    INSERT INTO bookmarks (user_id, url, normalized_url, title, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id, normalized_url) DO NOTHING
    RETURNING *
  `);
  const findByNormalized = db.prepare(
    'SELECT * FROM bookmarks WHERE user_id = ? AND normalized_url = ?',
  );
  const list = db.prepare('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY id DESC');
  const get = db.prepare('SELECT * FROM bookmarks WHERE user_id = ? AND id = ?');
  const remove = db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND id = ?');

  return {
    /**
     * Insert a bookmark unless this user already has the same normalised URL.
     * Returns { bookmark, created } where created=false means it was a repeat
     * and `bookmark` is the row that already existed (left unchanged).
     */
    create({ userId, url, normalizedUrl, title }) {
      const inserted = insert.get(userId, url, normalizedUrl, title, new Date().toISOString());
      if (inserted) return { bookmark: toBookmark(inserted), created: true };
      const existing = findByNormalized.get(userId, normalizedUrl);
      return { bookmark: toBookmark(existing), created: false };
    },

    list(userId) {
      return list.all(userId).map(toBookmark);
    },

    get(userId, id) {
      const row = get.get(userId, id);
      return row ? toBookmark(row) : null;
    },

    /** Returns true if a row was deleted. */
    delete(userId, id) {
      return remove.run(userId, id).changes > 0;
    },
  };
}
