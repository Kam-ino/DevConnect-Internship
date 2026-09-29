import { createApp } from './app.js';
import { openDb } from './db.js';
import { startSupervisor } from './supervisor.js';

const port = Number(process.env.PORT) || 3000;
const dbFile = process.env.DB_FILE || 'wrapped.db';
if (dbFile === ':memory:') {
  console.error('DB_FILE must be a file: the web process and the worker process share it.');
  process.exit(1);
}

const db = openDb(dbFile);
const supervisor = startSupervisor({ db, env: { DB_FILE: dbFile } });
const server = createApp({ db, workerControl: supervisor }).listen(port, () => {
  console.log(`Spending Wrapped listening on http://localhost:${port} (db: ${dbFile})`);
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await supervisor.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
