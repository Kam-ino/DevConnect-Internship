import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { seedIfEmpty } from '../src/seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function makeClient(base) {
  return async function request(method, urlPath, { json, raw, contentType } = {}) {
    const headers = {};
    let body;
    if (json !== undefined) {
      body = JSON.stringify(json);
      headers['Content-Type'] = 'application/json';
    } else if (raw !== undefined) {
      body = raw;
      if (contentType) headers['Content-Type'] = contentType;
    }
    const started = performance.now();
    const res = await fetch(base + urlPath, { method, headers, body });
    const text = await res.text();
    return {
      status: res.status,
      headers: res.headers,
      body: text ? JSON.parse(text) : null,
      ms: performance.now() - started,
    };
  };
}

export async function startInProcess() {
  const db = openDb(':memory:');
  seedIfEmpty(db);
  const server = createApp({ db }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = () => new Promise((resolve) => server.close(() => { db.close(); resolve(); }));
  return { db, base, request: makeClient(base), close };
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

export async function startCluster({ workers = 4 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-sales-'));
  const dbFile = path.join(dir, 'tickets.db');
  const port = await freePort();
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DB_FILE: dbFile, WORKERS: String(workers) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${output}`)), 30000);
    const onData = (chunk) => {
      output += chunk;
      if (output.includes('listening')) { clearTimeout(timer); resolve(); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited ${code}:\n${output}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve) => {
    child.removeAllListeners('exit');
    child.once('exit', () => {
      fs.rmSync(dir, { recursive: true, force: true });
      resolve();
    });
    child.kill('SIGTERM');
  });
  return { base, dbFile, request: makeClient(base), close };
}
