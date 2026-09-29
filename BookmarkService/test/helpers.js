import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';

/** Start the app on a random port with a fresh in-memory database. */
export async function startServer() {
  const db = openDb(':memory:');
  const server = createApp({ db }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  /**
   * request('POST', '/bookmarks', { json: {...} })
   * request('POST', '/bookmarks', { raw: 'not json', contentType: 'application/json' })
   */
  async function request(method, path, { json, raw, contentType, user = 'alice' } = {}) {
    const headers = {};
    if (user !== null) headers['X-User-Id'] = user;
    let body;
    if (json !== undefined) {
      body = JSON.stringify(json);
      headers['Content-Type'] = 'application/json';
    } else if (raw !== undefined) {
      body = raw;
      if (contentType) headers['Content-Type'] = contentType;
    }
    const res = await fetch(base + path, { method, headers, body });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }

  const rowCount = () => db.prepare('SELECT COUNT(*) AS n FROM bookmarks').get().n;

  const close = () => new Promise((resolve) => server.close(() => { db.close(); resolve(); }));

  return { request, rowCount, close };
}
