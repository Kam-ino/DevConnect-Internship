import { openDb } from './db.js';
import { claimNext, recordJobError, runJob } from './jobs.js';

const owner = process.env.WORKER_ID || `worker-${process.pid}`;
const dbFile = process.env.DB_FILE || 'wrapped.db';
const rowDelayMs = Number(process.env.ROW_DELAY_MS ?? 8);
const pollMs = Number(process.env.POLL_MS ?? 250);

const db = openDb(dbFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
process.on('disconnect', () => { stopping = true; });

if (process.send) process.send({ type: 'worker-ready', owner, pid: process.pid });

while (!stopping) {
  let job = null;
  try {
    job = claimNext(db, owner);
  } catch (err) {
    console.error(`[${owner}] claim failed:`, err.message);
  }
  if (!job) {
    await sleep(pollMs);
    continue;
  }
  try {
    await runJob(db, job, owner, { rowDelayMs, sleep, shouldStop: () => stopping });
  } catch (err) {
    console.error(`[${owner}] import ${job.id} failed:`, err);
    try { recordJobError(db, job, owner, err); } catch (inner) { console.error(inner); }
  }
}

db.close();
process.exit(0);
