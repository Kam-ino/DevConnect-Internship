import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function tempDbFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spending-wrapped-'));
  return { file: path.join(dir, 'test.db'), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

export function makeClient(base) {
  async function request(method, urlPath, { token, json, csv, contentType, headers = {} } = {}) {
    const h = { ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    let body;
    if (json !== undefined) {
      body = JSON.stringify(json);
      h['Content-Type'] = 'application/json';
    } else if (csv !== undefined) {
      body = csv;
      h['Content-Type'] = contentType ?? 'text/csv';
    }
    const started = performance.now();
    const res = await fetch(base + urlPath, { method, headers: h, body });
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, headers: res.headers, body: parsed, ms: performance.now() - started };
  }
  async function signup(email = `user-${Math.random().toString(36).slice(2)}@example.com`, password = 'correct horse battery') {
    const res = await request('POST', '/auth/signup', { json: { email, password } });
    if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { email, password, token: res.body.token, userId: res.body.user.id };
  }
  return { request, signup };
}

export async function startInProcess(options = {}) {
  const { file, cleanup } = tempDbFile();
  const db = openDb(file);
  const server = createApp({ db, ...options }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = () => new Promise((resolve) => server.close(() => { db.close(); cleanup(); resolve(); }));
  return { db, base, ...makeClient(base), close };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

export async function startServer({ rowDelayMs = 5 } = {}) {
  const { file, cleanup } = tempDbFile();
  const port = await freePort();
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DB_FILE: file, ROW_DELAY_MS: String(rowDelayMs) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (c) => { output += c; });
  child.stderr.on('data', (c) => { output += c; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${output}`)), 30000);
    const check = () => { if (output.includes('listening')) { clearTimeout(timer); resolve(); } };
    child.stdout.on('data', check);
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited ${code}:\n${output}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve) => {
    child.removeAllListeners('exit');
    child.once('exit', () => { cleanup(); resolve(); });
    child.kill('SIGTERM');
  });
  return { base, dbFile: file, output: () => output, ...makeClient(base), close };
}

export async function waitFor(fn, { timeoutMs = 30000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
