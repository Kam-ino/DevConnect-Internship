import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [algorithm, N, r, p, salt, key] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64url');
  const actual = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const DUMMY_HASH = await hashPassword(randomBytes(12).toString('hex'));

export async function checkLogin(user, password) {
  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    return false;
  }
  return verifyPassword(password, user.password_hash);
}

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createSession(db, userId, now = Date.now()) {
  const token = newToken();
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), userId, expiresAt);
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export function findSession(db, token, now = Date.now()) {
  const row = db.prepare(`
    SELECT s.user_id, s.expires_at, u.email
      FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
  `).get(hashToken(token));
  if (!row) return { error: 'invalid' };
  if (row.expires_at <= now) return { error: 'expired' };
  return { user: { id: row.user_id, email: row.email } };
}

export function deleteSession(db, token) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}
