import { transaction } from './db.js';
import { prepareRows } from './csv.js';
import { rebuildSummaries } from './summary.js';

export const LEASE_MS = 15_000;
export const MAX_ATTEMPTS = 5;
export const MAX_ROW_ERRORS = 20;
export const BATCH_SIZE = 50;

const nowIso = () => new Date().toISOString();

class LeaseLost extends Error {}

export function logEvent(db, importId, kind, detail) {
  db.prepare('INSERT INTO import_events (import_id, at, kind, detail) VALUES (?, ?, ?, ?)').run(importId, nowIso(), kind, detail);
}

export function claimNext(db, owner, now = Date.now()) {
  for (;;) {
    const outcome = transaction(db, () => {
      const job = db.prepare(`
        SELECT * FROM imports
         WHERE status = 'queued' OR (status = 'running' AND lease_expires_at < ?)
         ORDER BY id LIMIT 1
      `).get(now);
      if (!job) return { none: true };

      if (job.attempts >= MAX_ATTEMPTS) {
        db.prepare(`
          UPDATE imports SET status = 'failed', lease_owner = NULL, lease_expires_at = NULL, finished_at = ?, last_error = ?
           WHERE id = ?
        `).run(nowIso(), `gave up after ${job.attempts} attempts`, job.id);
        logEvent(db, job.id, 'failed', `Gave up after ${job.attempts} attempts. Saved progress: row ${job.processed_rows} of ${job.total_rows}. Press "Run again" (POST /imports/${job.id}/rerun) to retry.`);
        return { skipped: true };
      }

      const attempt = job.attempts + 1;
      db.prepare(`
        UPDATE imports SET status = 'running', lease_owner = ?, lease_expires_at = ?, attempts = ?, started_at = COALESCE(started_at, ?)
         WHERE id = ?
      `).run(owner, now + LEASE_MS, attempt, nowIso(), job.id);
      if (job.status === 'running') {
        logEvent(db, job.id, 'reclaimed', `The lease held by ${job.lease_owner} had expired, so ${owner} took the job over.`);
      }
      if (job.processed_rows > 0) {
        logEvent(db, job.id, 'resumed', `${owner} resumed from row ${job.processed_rows + 1} of ${job.total_rows} (attempt ${attempt}).`);
      } else {
        logEvent(db, job.id, 'started', `${owner} started the import (attempt ${attempt}).`);
      }
      return { job: db.prepare('SELECT * FROM imports WHERE id = ?').get(job.id) };
    });
    if (outcome.none) return null;
    if (outcome.job) return outcome.job;
  }
}

export async function runJob(db, job, owner, { batchSize = BATCH_SIZE, rowDelayMs = 0, sleep, shouldStop = () => false } = {}) {
  let rows;
  try {
    rows = prepareRows(job.csv);
  } catch (err) {
    transaction(db, () => {
      db.prepare(`
        UPDATE imports SET status = 'failed', finished_at = ?, lease_owner = NULL, lease_expires_at = NULL, last_error = ?
         WHERE id = ? AND lease_owner = ?
      `).run(nowIso(), err.message, job.id, owner);
      logEvent(db, job.id, 'failed', `The file could not be read: ${err.message}. Fix the file and upload it again.`);
    });
    return { status: 'failed' };
  }

  const insert = db.prepare(`
    INSERT INTO transactions (user_id, import_id, row_key, date, merchant, category, amount_cents)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, row_key) DO NOTHING
  `);
  const checkpoint = db.prepare(`
    UPDATE imports
       SET processed_rows = ?, new_rows = new_rows + ?, duplicate_rows = duplicate_rows + ?,
           invalid_rows = invalid_rows + ?, row_errors = ?, lease_expires_at = ?
     WHERE id = ? AND lease_owner = ?
  `);

  let from = job.processed_rows;
  let errors = JSON.parse(job.row_errors);

  try {
    while (from < rows.length) {
      if (shouldStop()) {
        transaction(db, () => {
          db.prepare('UPDATE imports SET lease_expires_at = 0 WHERE id = ? AND lease_owner = ?').run(job.id, owner);
          logEvent(db, job.id, 'paused', `${owner} is shutting down after row ${from}; the next worker will resume from row ${from + 1}.`);
        });
        return { status: 'paused' };
      }
      const batch = rows.slice(from, from + batchSize);
      errors = transaction(db, () => {
        const nextErrors = [...errors];
        let added = 0;
        let duplicates = 0;
        let invalid = 0;
        for (const r of batch) {
          if (r.error) {
            invalid++;
            if (nextErrors.length < MAX_ROW_ERRORS) nextErrors.push({ row: r.n, error: r.error });
            continue;
          }
          const result = insert.run(job.user_id, job.id, r.key, r.date, r.merchant, r.category, r.amountCents);
          if (result.changes) added++; else duplicates++;
        }
        const saved = checkpoint.run(from + batch.length, added, duplicates, invalid, JSON.stringify(nextErrors), Date.now() + LEASE_MS, job.id, owner);
        if (saved.changes === 0) throw new LeaseLost();
        return nextErrors;
      });
      from += batch.length;
      if (rowDelayMs > 0 && sleep) await sleep(batch.length * rowDelayMs);
    }

    return transaction(db, () => {
      const fingerprint = rebuildSummaries(db, job.user_id);
      const done = db.prepare(`
        UPDATE imports SET status = 'done', finished_at = ?, lease_owner = NULL, lease_expires_at = NULL, summary_fingerprint = ?, last_error = NULL
         WHERE id = ? AND lease_owner = ?
      `).run(nowIso(), fingerprint, job.id, owner);
      if (done.changes === 0) throw new LeaseLost();
      const f = db.prepare('SELECT * FROM imports WHERE id = ?').get(job.id);
      logEvent(db, job.id, 'completed',
        `Processed ${f.total_rows} rows: ${f.new_rows} new, ${f.duplicate_rows} already imported, ${f.invalid_rows} invalid. Wrapped fingerprint ${fingerprint.slice(0, 12)}.`);
      return { status: 'done', fingerprint };
    });
  } catch (err) {
    if (err instanceof LeaseLost) return { status: 'lease_lost' };
    throw err;
  }
}

export function recordJobError(db, job, owner, err, retryInMs = 2000) {
  transaction(db, () => {
    const released = db.prepare(`
      UPDATE imports SET lease_expires_at = ?, last_error = ? WHERE id = ? AND lease_owner = ?
    `).run(Date.now() + retryInMs, String(err && err.message ? err.message : err).slice(0, 500), job.id, owner);
    if (released.changes) {
      logEvent(db, job.id, 'error', `Attempt ${job.attempts} failed: ${String(err && err.message ? err.message : err).slice(0, 200)}. It will be retried (at most ${MAX_ATTEMPTS} attempts).`);
    }
  });
}

export function releaseLeasesOf(db, owner, reason) {
  return transaction(db, () => {
    const jobs = db.prepare(`
      UPDATE imports SET lease_expires_at = 0
       WHERE lease_owner = ? AND status = 'running'
      RETURNING id, processed_rows, total_rows
    `).all(owner);
    for (const j of jobs) {
      logEvent(db, j.id, 'worker_died',
        `${owner} ${reason} with ${j.processed_rows} of ${j.total_rows} rows saved. Rows after the last checkpoint were rolled back; the job goes back in the queue.`);
    }
    return jobs.map((j) => j.id);
  });
}

export async function drain(db, owner = 'inline-worker', options = {}) {
  const results = [];
  for (let job = claimNext(db, owner); job; job = claimNext(db, owner)) {
    results.push(await runJob(db, job, owner, options));
  }
  return results;
}
