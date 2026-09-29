import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startInProcess } from './helpers.js';

let api;
before(async () => { api = await startInProcess(); });
after(() => api.close());

describe('401 without credentials', () => {
  const protectedRoutes = [
    ['GET', '/me'],
    ['GET', '/imports'],
    ['POST', '/imports'],
    ['GET', '/imports/1'],
    ['POST', '/imports/1/rerun'],
    ['POST', '/imports/1/crash-worker'],
    ['GET', '/wrapped'],
    ['GET', '/wrapped/2025'],
    ['POST', '/auth/logout'],
  ];

  for (const [method, path] of protectedRoutes) {
    it(`${method} ${path} with no token -> 401 unauthenticated`, async () => {
      const res = await api.request(method, path);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'unauthenticated');
      assert.match(res.body.error.message, /Authorization: Bearer/);
      assert.equal(res.headers.get('www-authenticate'), 'Bearer');
    });
  }

  it('a made-up token -> 401 invalid_token', async () => {
    const res = await api.request('GET', '/imports', { token: 'made-up' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'invalid_token');
  });

  it('an expired session -> 401 token_expired', async () => {
    const { token } = await api.signup();
    api.db.prepare('UPDATE sessions SET expires_at = 0').run();
    const res = await api.request('GET', '/me', { token });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'token_expired');
  });
});

describe('sign up, log in, log out', () => {
  it('signs up, logs in and uses the token', async () => {
    const signup = await api.request('POST', '/auth/signup', { json: { email: 'Kamino@Example.com', password: 'correct horse battery' } });
    assert.equal(signup.status, 201);
    assert.equal(signup.body.user.email, 'kamino@example.com');
    assert.ok(signup.body.token.length >= 40);

    const login = await api.request('POST', '/auth/login', { json: { email: 'kamino@example.com', password: 'correct horse battery' } });
    assert.equal(login.status, 200);
    const me = await api.request('GET', '/me', { token: login.body.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'kamino@example.com');

    const logout = await api.request('POST', '/auth/logout', { token: login.body.token });
    assert.equal(logout.status, 204);
    assert.equal((await api.request('GET', '/me', { token: login.body.token })).status, 401);
    assert.equal((await api.request('GET', '/me', { token: signup.body.token })).status, 200);
  });

  it('stores only a salted scrypt hash of the password and a sha256 of the token', async () => {
    const { email, token } = await api.signup();
    const row = api.db.prepare('SELECT password_hash FROM users WHERE email = ?').get(email);
    assert.match(row.password_hash, /^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
    assert.ok(!row.password_hash.includes('correct horse'));
    const stored = api.db.prepare('SELECT token_hash FROM sessions').all().map((r) => r.token_hash);
    assert.ok(!stored.includes(token));
  });

  it('actionable errors for bad sign-ups and logins', async () => {
    const { email } = await api.signup();
    const cases = [
      [{ email, password: 'correct horse battery' }, 409, 'email_taken', 'email'],
      [{ email: 'not-an-email', password: 'correct horse battery' }, 400, 'validation_failed', 'email'],
      [{ email: 'a@b.co', password: 'short' }, 400, 'validation_failed', 'password'],
      [{ email: 'a@b.co' }, 400, 'validation_failed', 'password'],
    ];
    for (const [json, status, code, field] of cases) {
      const res = await api.request('POST', '/auth/signup', { json });
      assert.equal(res.status, status, JSON.stringify(json));
      assert.equal(res.body.error.code, code);
      assert.equal(res.body.error.field, field);
    }
    const wrong = await api.request('POST', '/auth/login', { json: { email, password: 'wrong password!' } });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.code, 'invalid_credentials');
    const unknown = await api.request('POST', '/auth/login', { json: { email: 'nobody@example.com', password: 'wrong password!' } });
    assert.equal(unknown.body.error.code, 'invalid_credentials');
  });
});

describe('rate limiting', () => {
  it('429 with Retry-After after too many attempts', async () => {
    const limited = await startInProcess({ authRateLimit: 3 });
    try {
      const attempt = () => limited.request('POST', '/auth/login', { json: { email: 'x@example.com', password: 'whatever123' } });
      for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
      const res = await attempt();
      assert.equal(res.status, 429);
      assert.equal(res.body.error.code, 'rate_limited');
      assert.ok(Number(res.headers.get('retry-after')) > 0);
    } finally {
      await limited.close();
    }
  });
});
