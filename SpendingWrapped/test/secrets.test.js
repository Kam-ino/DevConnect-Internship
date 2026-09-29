import { it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.js';

const PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk_(live|test)_[0-9a-zA-Z]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{36}\b/,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/,
  /\b(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9+/_\-]{16,}['"]/i,
];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.git'].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

it('no .env file and no secret-looking strings in the project', () => {
  const all = files(ROOT);
  assert.ok(!all.some((f) => /(^|[\\/])\.env(\.|$)/.test(f)), 'a .env file exists in the project');
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.env$/m);
  for (const file of all.filter((f) => /\.(js|json|md|html|ya?ml|txt)$/.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      assert.ok(!pattern.test(text), `${path.relative(ROOT, file)} matches ${pattern}`);
    }
  }
});
