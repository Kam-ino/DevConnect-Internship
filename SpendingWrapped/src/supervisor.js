import { fork } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseLeasesOf } from './jobs.js';

const WORKER_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'worker.js');

export function startSupervisor({ db, env = {}, restartDelayMs = 1000, log = console.log }) {
  let child = null;
  let current = null;
  let generation = 0;
  let stopping = false;

  function spawnWorker() {
    generation += 1;
    const id = `worker-${generation}-${randomBytes(2).toString('hex')}`;
    const proc = fork(WORKER_PATH, [], {
      env: { ...process.env, ...env, WORKER_ID: id },
      execArgv: ['--disable-warning=ExperimentalWarning'],
    });
    child = proc;
    current = { id, pid: proc.pid, startedAt: new Date().toISOString() };
    log(`[supervisor] started ${id} (pid ${proc.pid})`);

    proc.on('exit', (code, signal) => {
      const how = signal ? `was killed (${signal})` : `exited with code ${code}`;
      try {
        const released = releaseLeasesOf(db, id, how);
        log(`[supervisor] ${id} ${how}; released ${released.length} job(s)${released.length ? `: ${released.join(', ')}` : ''}`);
      } catch (err) {
        log(`[supervisor] could not release leases of ${id}: ${err.message}`);
      }
      if (child === proc) child = null;
      if (!stopping) setTimeout(spawnWorker, restartDelayMs);
    });
  }

  spawnWorker();

  return {
    status: () => ({ ...current, alive: Boolean(child) }),
    kill() {
      if (!child) return null;
      const killed = { ...current };
      child.kill('SIGKILL');
      return killed;
    },
    stop() {
      stopping = true;
      if (!child) return Promise.resolve();
      return new Promise((resolve) => {
        const proc = child;
        const timer = setTimeout(() => proc.kill('SIGKILL'), 5000);
        proc.once('exit', () => { clearTimeout(timer); resolve(); });
        proc.kill('SIGTERM');
      });
    },
  };
}
