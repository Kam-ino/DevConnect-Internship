import { createApp } from './app.js';
import { openDb } from './db.js';

const port = Number(process.env.PORT) || 3000;
const dbFile = process.env.DB_FILE || 'bookmarks.db';

const db = openDb(dbFile);
const server = createApp({ db }).listen(port, () => {
  console.log(`Bookmark service listening on http://localhost:${port} (db: ${dbFile})`);
});

const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
