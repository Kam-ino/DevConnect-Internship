import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { checkLogin, createSession, deleteSession, findSession, hashPassword } from './auth.js';
import { inspectCsv, REQUIRED_COLUMNS } from './csv.js';
import { transaction } from './db.js';
import { logEvent } from './jobs.js';
import { generateSampleCsv } from './sample.js';
import { combinedFingerprint, readSummaries } from './summary.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CSV_LIMIT = '2mb';
export const MAX_ROWS = 20_000;
const SQLITE_CONSTRAINT_UNIQUE = 2067;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,100}$/;
const ID = /^[1-9][0-9]{0,14}$/;

function sendError(res, status, code, message, extra = {}) {
  res.status(status).json({ error: { code, message, ...extra } });
}

function rateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return sendError(res, 429, 'rate_limited', `Too many attempts. Wait ${retryAfter} seconds and try again.`, { retryAfterSeconds: retryAfter });
    }
    if (hits.size > 10_000) hits.clear();
    next();
  };
}

function toImport(row, events) {
  return {
    id: row.id,
    filename: row.filename,
    status: row.status,
    totalRows: row.total_rows,
    processedRows: row.processed_rows,
    newRows: row.new_rows,
    duplicateRows: row.duplicate_rows,
    invalidRows: row.invalid_rows,
    rowErrors: JSON.parse(row.row_errors),
    attempts: row.attempts,
    runCount: row.run_count,
    lastError: row.last_error,
    summaryFingerprint: row.summary_fingerprint,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    ...(events && { events: events.map((e) => ({ at: e.at, kind: e.kind, detail: e.detail })) }),
    links: { self: `/imports/${row.id}`, wrapped: '/wrapped' },
  };
}

export function createApp({ db, workerControl = null, authRateLimit = 30 }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    insertUser: db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) RETURNING id, email'),
    importOf: db.prepare('SELECT * FROM imports WHERE id = ? AND user_id = ?'),
    importByKey: db.prepare('SELECT * FROM imports WHERE user_id = ? AND idempotency_key = ?'),
    importsOf: db.prepare('SELECT * FROM imports WHERE user_id = ? ORDER BY id DESC LIMIT 50'),
    eventsOf: db.prepare('SELECT at, kind, detail FROM import_events WHERE import_id = ? ORDER BY id'),
    insertImport: db.prepare(`
      INSERT INTO imports (user_id, idempotency_key, content_hash, filename, csv, status, total_rows, created_at)
      VALUES (?, ?, ?, ?, ?, 'queued', ?, ?) RETURNING *
    `),
    transactionCount: db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?'),
  };

  const jsonBody = express.json({ limit: '10kb' });
  const csvBody = express.text({ type: ['text/csv', 'text/plain', 'application/csv'], limit: CSV_LIMIT });
  const authLimiter = rateLimiter({ limit: authRateLimit, windowMs: 60_000 });

  app.use(express.static(path.join(PROJECT_ROOT, 'public'), { index: 'index.html' }));
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok', worker: workerControl ? workerControl.status() : null }));
  app.get('/README.md', (req, res) => res.type('text/markdown; charset=utf-8').sendFile(path.join(PROJECT_ROOT, 'README.md')));
  app.get('/sample.csv', (req, res) => {
    res.type('text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="sample-spending-2025.csv"').send(generateSampleCsv());
  });

  function requireAuth(req, res, next) {
    const header = req.get('Authorization') || '';
    const match = header.match(/^Bearer\s+(\S+)$/i);
    res.set('WWW-Authenticate', 'Bearer');
    if (!match) {
      return sendError(res, 401, 'unauthenticated', 'This route needs a token. Send "Authorization: Bearer <token>"; get a token from POST /auth/login or POST /auth/signup.');
    }
    const found = findSession(db, match[1]);
    if (found.error === 'expired') return sendError(res, 401, 'token_expired', 'Your session expired. Log in again with POST /auth/login.');
    if (found.error) return sendError(res, 401, 'invalid_token', 'This token is not valid. Log in again with POST /auth/login.');
    res.removeHeader('WWW-Authenticate');
    req.user = found.user;
    req.token = match[1];
    next();
  }

  function readCredentials(req, res) {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendError(res, 400, 'invalid_body', 'Send a JSON object like {"email": "you@example.com", "password": "..."} with Content-Type: application/json.', { field: 'body' });
      return null;
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || email.length > 254 || !EMAIL.test(email)) {
      sendError(res, 400, 'validation_failed', 'email must be a valid email address.', { field: 'email' });
      return null;
    }
    if (password.length < 8 || password.length > 200) {
      sendError(res, 400, 'validation_failed', 'password must be 8 to 200 characters long.', { field: 'password' });
      return null;
    }
    return { email, password };
  }

  app.post('/auth/signup', authLimiter, jsonBody, async (req, res) => {
    const creds = readCredentials(req, res);
    if (!creds) return;
    const passwordHash = await hashPassword(creds.password);
    let user;
    try {
      user = q.insertUser.get(creds.email, passwordHash, new Date().toISOString());
    } catch (err) {
      if (err.errcode === SQLITE_CONSTRAINT_UNIQUE) {
        return sendError(res, 409, 'email_taken', 'An account with this email already exists. Log in with POST /auth/login instead.', { field: 'email' });
      }
      throw err;
    }
    const session = createSession(db, user.id);
    res.status(201).json({ user: { id: user.id, email: user.email }, ...session });
  });

  app.post('/auth/login', authLimiter, jsonBody, async (req, res) => {
    const creds = readCredentials(req, res);
    if (!creds) return;
    const user = q.userByEmail.get(creds.email);
    if (!(await checkLogin(user, creds.password))) {
      return sendError(res, 401, 'invalid_credentials', 'Email or password is wrong. Check both, or create an account with POST /auth/signup.');
    }
    const session = createSession(db, user.id);
    res.status(200).json({ user: { id: user.id, email: user.email }, ...session });
  });

  app.post('/auth/logout', requireAuth, (req, res) => {
    deleteSession(db, req.token);
    res.status(204).end();
  });

  app.get('/me', requireAuth, (req, res) => {
    res.status(200).json({ user: req.user, transactions: q.transactionCount.get(req.user.id).n });
  });

  function loadImport(req, res, next) {
    const raw = req.params.importId;
    if (!ID.test(raw)) return sendError(res, 400, 'validation_failed', 'importId must be a positive integer.', { field: 'importId' });
    const row = q.importOf.get(Number(raw), req.user.id);
    if (!row) return sendError(res, 404, 'not_found', `You have no import with id ${raw}. List yours with GET /imports.`);
    req.importRow = row;
    next();
  }

  app.post('/imports', requireAuth, csvBody, (req, res) => {
    const started = performance.now();
    const csv = req.body;
    if (typeof csv !== 'string') {
      return sendError(res, 415, 'unsupported_media_type', 'Send the CSV file itself as the request body with Content-Type: text/csv.');
    }
    const key = req.get('Idempotency-Key');
    if (key !== undefined && !IDEMPOTENCY_KEY.test(key)) {
      return sendError(res, 400, 'validation_failed', 'Idempotency-Key must be 1 to 100 characters of letters, digits and . _ : -', { field: 'Idempotency-Key' });
    }
    const rawName = typeof req.query.filename === 'string' ? req.query.filename : 'upload.csv';
    const filename = rawName.replace(/[^\w .()-]/g, '').trim().slice(0, 100) || 'upload.csv';

    const info = inspectCsv(csv);
    if (info.missing.length && !info.empty) {
      return sendError(res, 400, 'csv_missing_columns', `The first row must name the columns. Missing: ${info.missing.join(', ')}.`, {
        missing: info.missing, expected: REQUIRED_COLUMNS, found: info.found,
      });
    }
    if (info.empty) {
      return sendError(res, 400, 'csv_empty', 'The file has no data rows. Expected a header row (date,merchant,amount) and at least one transaction.');
    }
    if (info.dataRows > MAX_ROWS) {
      return sendError(res, 413, 'too_many_rows', `The file has ${info.dataRows} rows; the limit is ${MAX_ROWS}. Split it into smaller files.`, { limit: MAX_ROWS });
    }

    const contentHash = createHash('sha256').update(csv).digest('hex');
    const replay = (existing) => {
      if (existing.content_hash !== contentHash) {
        return sendError(res, 422, 'idempotency_key_reused', `Idempotency-Key "${key}" was already used for a different file (import ${existing.id}). Use a new key for a new upload.`, { importId: existing.id });
      }
      res.set('Idempotent-Replayed', 'true');
      return res.status(202).location(`/imports/${existing.id}`).json(toImport(existing));
    };

    if (key) {
      const existing = q.importByKey.get(req.user.id, key);
      if (existing) return replay(existing);
    }

    let row;
    try {
      row = transaction(db, () => {
        const created = q.insertImport.get(req.user.id, key ?? null, contentHash, filename, csv, info.dataRows, new Date().toISOString());
        logEvent(db, created.id, 'queued', `Upload accepted: ${info.dataRows} rows. Waiting for a worker.`);
        return created;
      });
    } catch (err) {
      if (err.errcode === SQLITE_CONSTRAINT_UNIQUE && key) return replay(q.importByKey.get(req.user.id, key));
      throw err;
    }
    res.set('Server-Timing', `app;dur=${(performance.now() - started).toFixed(1)}`);
    res.status(202).location(`/imports/${row.id}`).json(toImport(row));
  });

  app.get('/imports', requireAuth, (req, res) => {
    res.status(200).json({ imports: q.importsOf.all(req.user.id).map((r) => toImport(r)) });
  });

  app.get('/imports/:importId', requireAuth, loadImport, (req, res) => {
    res.status(200).json(toImport(req.importRow, q.eventsOf.all(req.importRow.id)));
  });

  app.post('/imports/:importId/rerun', requireAuth, loadImport, (req, res) => {
    const job = req.importRow;
    if (job.status === 'queued' || job.status === 'running') {
      return sendError(res, 409, 'import_in_progress', `Import ${job.id} is still ${job.status}. Wait for it to finish, then run it again.`, { status: job.status });
    }
    const row = transaction(db, () => {
      db.prepare(`
        UPDATE imports SET status = 'queued', processed_rows = 0, new_rows = 0, duplicate_rows = 0, invalid_rows = 0,
               row_errors = '[]', attempts = 0, run_count = run_count + 1, lease_owner = NULL, lease_expires_at = NULL,
               last_error = NULL, started_at = NULL, finished_at = NULL
         WHERE id = ?
      `).run(job.id);
      logEvent(db, job.id, 'rerun_requested', `Run ${job.run_count + 1} requested. Every row will be processed again; rows already saved are skipped, so the result must not change.`);
      return db.prepare('SELECT * FROM imports WHERE id = ?').get(job.id);
    });
    res.status(202).location(`/imports/${row.id}`).json(toImport(row));
  });

  app.post('/imports/:importId/crash-worker', requireAuth, loadImport, (req, res) => {
    const job = req.importRow;
    if (!workerControl) return sendError(res, 503, 'worker_unavailable', 'No background worker is attached to this server.');
    const worker = workerControl.status();
    if (job.status !== 'running' || job.lease_owner !== worker.id) {
      return sendError(res, 409, 'import_not_running', `Import ${job.id} is ${job.status}, not being processed right now, so there is nothing to interrupt.`, { status: job.status });
    }
    logEvent(db, job.id, 'crash_requested', `Crash button pressed: sending SIGKILL to ${worker.id} (pid ${worker.pid}) at row ${job.processed_rows} of ${job.total_rows}.`);
    const killed = workerControl.kill();
    res.status(202).json({ killed, importId: job.id, processedRowsAtCrash: job.processed_rows });
  });

  app.get('/wrapped', requireAuth, (req, res) => {
    const summaries = readSummaries(db, req.user.id);
    const fingerprint = summaries.length
      ? combinedFingerprint([...summaries].sort((a, b) => a.year - b.year).map((s) => `${s.year}:${s.fingerprint}`))
      : null;
    res.status(200).json({ years: summaries.map((s) => s.year), fingerprint, summaries });
  });

  app.get('/wrapped/:year', requireAuth, (req, res) => {
    const summaries = readSummaries(db, req.user.id);
    const found = summaries.find((s) => String(s.year) === req.params.year);
    if (!found) {
      return sendError(res, 404, 'no_data_for_year', `No spending imported for ${req.params.year}.`, { availableYears: summaries.map((s) => s.year) });
    }
    res.status(200).json(found);
  });

  app.use((req, res) => sendError(res, 404, 'route_not_found', `No route for ${req.method} ${req.path}. See the README for the list of endpoints.`));

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') return sendError(res, 400, 'invalid_json', 'The request body is not valid JSON.', { field: 'body' });
    if (err.type === 'entity.too.large') {
      return sendError(res, 413, 'payload_too_large', `The request body is too large (limit ${req.path.startsWith('/imports') ? CSV_LIMIT : '10kb'}).`);
    }
    if (err.type === 'charset.unsupported' || err.type === 'encoding.unsupported') {
      return sendError(res, 415, 'unsupported_media_type', 'Send the body as UTF-8.');
    }
    if (err.errcode === 5 || (err.errcode & 0xff) === 5) {
      res.set('Retry-After', '1');
      return sendError(res, 503, 'busy', 'The database is busy. Retry in a second.', { retryAfterSeconds: 1 });
    }
    if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
      return sendError(res, err.status, 'bad_request', err.expose ? err.message : 'Bad request.');
    }
    console.error(err);
    return sendError(res, 500, 'internal_error', 'Something went wrong on our side. It has been logged; try again.');
  });

  return app;
}
