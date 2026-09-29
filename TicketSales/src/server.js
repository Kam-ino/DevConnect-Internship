import cluster from 'node:cluster';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { seedIfEmpty } from './seed.js';

const port = Number(process.env.PORT) || 3000;
const dbFile = process.env.DB_FILE || 'tickets.db';
const inMemory = dbFile === ':memory:';
const workers = inMemory ? 1 : Math.max(1, Number(process.env.WORKERS) || 4);

function describeSeed(result) {
  return result
    ? `seeded ${result.events} events, ${result.seats} seats, ${result.orders} orders`
    : 'using existing data';
}

function startWorker(db) {
  const server = createApp({ db }).listen(port, () => {
    if (process.send) process.send({ type: 'ready' });
  });
  const stop = () => server.close(() => { db.close(); process.exit(0); });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (inMemory) {
  const db = openDb(dbFile);
  const seeded = seedIfEmpty(db);
  startWorker(db);
  console.log(`Ticket sales listening on http://localhost:${port} (1 process, in-memory db, ${describeSeed(seeded)})`);
} else if (cluster.isPrimary) {
  const db = openDb(dbFile);
  const seeded = seedIfEmpty(db);
  db.close();

  let ready = 0;
  let stopping = false;
  cluster.on('message', (worker, msg) => {
    if (msg && msg.type === 'ready' && ++ready === workers) {
      console.log(`Ticket sales listening on http://localhost:${port} (${workers} worker processes, db: ${dbFile}, ${describeSeed(seeded)})`);
    }
  });
  cluster.on('exit', () => {
    if (!stopping) cluster.fork();
  });
  for (let i = 0; i < workers; i++) cluster.fork();

  const stop = () => {
    stopping = true;
    for (const worker of Object.values(cluster.workers)) worker.kill('SIGTERM');
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} else {
  startWorker(openDb(dbFile));
}
