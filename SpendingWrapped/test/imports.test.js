import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { claimNext, drain, LEASE_MS, MAX_ATTEMPTS, runJob } from '../src/jobs.js';
import { generateSampleCsv } from '../src/sample.js';
import { startInProcess } from './helpers.js';

const SAMPLE = generateSampleCsv();
const VALID_ROWS = 1187;

let api;
before(async () => { api = await startInProcess(); });
after(() => api.close());

const upload = (token, csv = SAMPLE, headers = {}) => api.request('POST', '/imports?filename=sample.csv', { token, csv, headers });
const txCount = (userId) => api.db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(userId).n;
const wrapped = async (token) => (await api.request('GET', '/wrapped', { token })).body;

describe('the upload returns without waiting for the import', () => {
  it('202 in well under a second, with nothing imported yet', async () => {
    const { token, userId } = await api.signup();
    const res = await upload(token);
    assert.equal(res.status, 202);
    assert.equal(res.body.status, 'queued');
    assert.equal(res.body.totalRows, 1191);
    assert.equal(res.headers.get('location'), `/imports/${res.body.id}`);
    assert.ok(res.ms < 500, `upload took ${res.ms.toFixed(0)} ms`);
    assert.equal(txCount(userId), 0);

    await drain(api.db);
    const done = await api.request('GET', `/imports/${res.body.id}`, { token });
    assert.equal(done.body.status, 'done');
    assert.equal(done.body.newRows, VALID_ROWS);
    assert.equal(done.body.invalidRows, 4);
    assert.deepEqual(done.body.rowErrors.map((e) => e.row), [41, 301, 611, 901]);
    assert.equal(txCount(userId), VALID_ROWS);
    assert.deepEqual(done.body.events.map((e) => e.kind), ['queued', 'started', 'completed']);
  });
});

describe('running the work twice gives the same outcome', () => {
  it('"Run again" leaves the same rows and the same Wrapped fingerprint', async () => {
    const { token, userId } = await api.signup();
    const first = await upload(token);
    await drain(api.db);
    const before = await wrapped(token);
    const fp1 = (await api.request('GET', `/imports/${first.body.id}`, { token })).body.summaryFingerprint;

    const rerun = await api.request('POST', `/imports/${first.body.id}/rerun`, { token });
    assert.equal(rerun.status, 202);
    await drain(api.db);
    const second = (await api.request('GET', `/imports/${first.body.id}`, { token })).body;
    assert.equal(second.runCount, 2);
    assert.equal(second.newRows, 0);
    assert.equal(second.duplicateRows, VALID_ROWS);
    assert.equal(second.summaryFingerprint, fp1);
    assert.equal((await wrapped(token)).fingerprint, fp1);
    assert.equal(txCount(userId), VALID_ROWS);
    const after = await wrapped(token);
    assert.deepEqual(after.summaries.map(({ builtAt, ...s }) => s), before.summaries.map(({ builtAt, ...s }) => s));
  });

  it('uploading the same file again adds nothing', async () => {
    const { token, userId } = await api.signup();
    await upload(token);
    await drain(api.db);
    const again = await upload(token);
    await drain(api.db);
    const res = (await api.request('GET', `/imports/${again.body.id}`, { token })).body;
    assert.equal(res.newRows, 0);
    assert.equal(res.duplicateRows, VALID_ROWS);
    assert.equal(txCount(userId), VALID_ROWS);
  });

  it('two workers holding the same job: the one that lost its lease cannot write', async () => {
    const { token, userId } = await api.signup();
    const { body } = await upload(token);
    const jobA = claimNext(api.db, 'worker-A');
    assert.equal(jobA.id, body.id);
    const jobB = claimNext(api.db, 'worker-B', Date.now() + LEASE_MS + 1);
    assert.equal(jobB.id, body.id);
    assert.equal(jobB.attempts, 2);

    assert.deepEqual(await runJob(api.db, jobA, 'worker-A'), { status: 'lease_lost' });
    assert.equal(txCount(userId), 0);
    assert.equal((await runJob(api.db, jobB, 'worker-B')).status, 'done');
    assert.equal(txCount(userId), VALID_ROWS);
    const events = (await api.request('GET', `/imports/${body.id}`, { token })).body.events.map((e) => e.kind);
    assert.ok(events.includes('reclaimed'));
  });

  it(`gives up after ${MAX_ATTEMPTS} attempts and says so`, async () => {
    const { token } = await api.signup();
    const { body } = await upload(token, 'date,merchant,amount\n2025-01-01,Jollibee,120\n');
    api.db.prepare('UPDATE imports SET attempts = ? WHERE id = ?').run(MAX_ATTEMPTS, body.id);
    claimNext(api.db, 'worker-X');
    const res = (await api.request('GET', `/imports/${body.id}`, { token })).body;
    assert.equal(res.status, 'failed');
    assert.match(res.events.at(-1).detail, /Gave up after 5 attempts.*Run again/);
  });
});

describe('Idempotency-Key makes the upload safe to retry', () => {
  it('same key and same file -> same import, one row', async () => {
    const { token, userId } = await api.signup();
    const a = await upload(token, SAMPLE, { 'Idempotency-Key': 'upload-2025' });
    const b = await upload(token, SAMPLE, { 'Idempotency-Key': 'upload-2025' });
    assert.equal(a.status, 202);
    assert.equal(b.status, 202);
    assert.equal(b.body.id, a.body.id);
    assert.equal(b.headers.get('idempotent-replayed'), 'true');
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM imports WHERE user_id = ?').get(userId).n, 1);
  });

  it('five retries at the same moment -> still one import', async () => {
    const { token, userId } = await api.signup();
    const results = await Promise.all(Array.from({ length: 5 }, () => upload(token, SAMPLE, { 'Idempotency-Key': 'burst' })));
    assert.ok(results.every((r) => r.status === 202));
    assert.equal(new Set(results.map((r) => r.body.id)).size, 1);
    assert.equal(api.db.prepare('SELECT COUNT(*) AS n FROM imports WHERE user_id = ?').get(userId).n, 1);
  });

  it('same key, different file -> 422 idempotency_key_reused', async () => {
    const { token } = await api.signup();
    await upload(token, SAMPLE, { 'Idempotency-Key': 'k1' });
    const res = await upload(token, 'date,merchant,amount\n2025-01-01,Jollibee,120\n', { 'Idempotency-Key': 'k1' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'idempotency_key_reused');
  });
});

describe('actionable errors on upload', () => {
  it('names what is wrong and how to fix it', async () => {
    const { token } = await api.signup();
    const missing = await upload(token, 'when,shop,cost\n1,2,3\n');
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.code, 'csv_missing_columns');
    assert.deepEqual(missing.body.error.missing, ['date', 'merchant', 'amount']);
    assert.deepEqual(missing.body.error.found, ['when', 'shop', 'cost']);

    assert.equal((await upload(token, 'date,merchant,amount\n')).body.error.code, 'csv_empty');
    assert.equal((await upload(token, '')).body.error.code, 'csv_empty');

    const json = await api.request('POST', '/imports', { token, json: { csv: 'x' } });
    assert.equal(json.status, 415);
    assert.equal(json.body.error.code, 'unsupported_media_type');

    const bigRows = 'date,merchant,amount\n' + '2025-01-01,a,1\n'.repeat(20_001);
    const big = await upload(token, bigRows);
    assert.equal(big.status, 413);
    assert.equal(big.body.error.code, 'too_many_rows');

    const badKey = await upload(token, SAMPLE, { 'Idempotency-Key': 'has spaces' });
    assert.equal(badKey.body.error.field, 'Idempotency-Key');

    const rerun = await upload(token, 'date,merchant,amount\n2025-01-01,Jollibee,120\n');
    const busy = await api.request('POST', `/imports/${rerun.body.id}/rerun`, { token });
    assert.equal(busy.status, 409);
    assert.equal(busy.body.error.code, 'import_in_progress');
    await drain(api.db);
  });
});

describe("no reading another person's rows", () => {
  it('user B cannot see, rerun or crash user A\'s import, and has an empty Wrapped', async () => {
    const a = await api.signup();
    const b = await api.signup();
    const { body } = await upload(a.token);
    await drain(api.db);
    for (const [method, path] of [['GET', `/imports/${body.id}`], ['POST', `/imports/${body.id}/rerun`], ['POST', `/imports/${body.id}/crash-worker`]]) {
      const res = await api.request(method, path, { token: b.token });
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.equal(res.body.error.code, 'not_found');
    }
    assert.deepEqual((await api.request('GET', '/imports', { token: b.token })).body.imports, []);
    assert.deepEqual((await wrapped(b.token)).summaries, []);
    assert.equal((await api.request('GET', '/wrapped/2025', { token: b.token })).status, 404);
    assert.equal((await wrapped(a.token)).summaries[0].transactions, VALID_ROWS);
  });
});
