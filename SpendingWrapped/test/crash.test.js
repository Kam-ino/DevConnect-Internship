import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { drain } from '../src/jobs.js';
import { generateSampleCsv } from '../src/sample.js';
import { startServer, tempDbFile, waitFor } from './helpers.js';

const SAMPLE = generateSampleCsv();

async function cleanRunFingerprint() {
  const { file, cleanup } = tempDbFile();
  const db = openDb(file);
  try {
    const user = db.prepare("INSERT INTO users (email, password_hash, created_at) VALUES ('clean@example.com', 'x', 'now') RETURNING id").get();
    db.prepare("INSERT INTO imports (user_id, content_hash, filename, csv, status, total_rows, created_at) VALUES (?, 'h', 'clean.csv', ?, 'queued', 1191, 'now')").run(user.id, SAMPLE);
    const [result] = await drain(db);
    return result.fingerprint;
  } finally {
    db.close();
    cleanup();
  }
}

let server;
before(async () => { server = await startServer({ rowDelayMs: 5 }); });
after(() => server.close());

describe('the worker process is killed halfway through an import', () => {
  it('the job resumes from its checkpoint and ends exactly like a clean run', async () => {
    const expected = await cleanRunFingerprint();
    const { token } = await server.signup();
    const upload = await server.request('POST', '/imports?filename=sample.csv', { token, csv: SAMPLE });
    assert.equal(upload.status, 202);
    const id = upload.body.id;
    const get = async () => (await server.request('GET', `/imports/${id}`, { token })).body;

    const mid = await waitFor(async () => {
      const s = await get();
      return s.status === 'running' && s.processedRows >= 300 && s.processedRows < 900 ? s : null;
    }, { intervalMs: 20 });

    const crash = await server.request('POST', `/imports/${id}/crash-worker`, { token });
    assert.equal(crash.status, 202, JSON.stringify(crash.body));

    const died = await waitFor(async () => {
      const s = await get();
      return s.events.some((e) => e.kind === 'worker_died') ? s : null;
    });
    assert.ok(died.processedRows >= mid.processedRows);
    assert.ok(died.processedRows < died.totalRows);

    const done = await waitFor(async () => {
      const s = await get();
      return s.status === 'done' ? s : null;
    });

    const kinds = done.events.map((e) => e.kind);
    for (const kind of ['queued', 'started', 'crash_requested', 'worker_died', 'resumed', 'completed']) {
      assert.ok(kinds.includes(kind), `missing ${kind} in ${kinds.join(', ')}`);
    }
    assert.equal(done.attempts, 2);
    assert.equal(done.newRows + done.duplicateRows, 1187);
    assert.equal(done.invalidRows, 4);
    assert.equal(done.summaryFingerprint, expected);
    const me = await server.request('GET', '/me', { token });
    assert.equal(me.body.transactions, 1187);

    const resumed = done.events.find((e) => e.kind === 'resumed').detail;
    assert.match(resumed, new RegExp(`resumed from row ${died.processedRows + 1} of 1191`));

    const health = await server.request('GET', '/health');
    assert.equal(health.body.worker.alive, true);
    assert.notEqual(health.body.worker.id, crash.body.killed.id);
  });

  it('crashing when nothing is running -> 409 with the reason', async () => {
    const { token } = await server.signup();
    const upload = await server.request('POST', '/imports', { token, csv: 'date,merchant,amount\n2025-01-01,Jollibee,120\n' });
    await waitFor(async () => (await server.request('GET', `/imports/${upload.body.id}`, { token })).body.status === 'done');
    const res = await server.request('POST', `/imports/${upload.body.id}/crash-worker`, { token });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'import_not_running');
  });
});
