import { createHash } from 'node:crypto';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const byTotalThenName = (a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name);

function group(rows, keyOf) {
  const map = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    const g = map.get(key) || { name: key, totalCents: 0, count: 0 };
    g.totalCents += r.amount_cents;
    g.count += 1;
    map.set(key, g);
  }
  return [...map.values()];
}

export function buildSummary(year, rows) {
  const totalCents = rows.reduce((s, r) => s + r.amount_cents, 0);
  const days = new Set(rows.map((r) => r.date)).size;
  const merchants = group(rows, (r) => r.merchant);
  const categories = group(rows, (r) => r.category).sort(byTotalThenName);
  const months = group(rows, (r) => r.date.slice(0, 7)).sort(byTotalThenName);
  const weekdays = group(rows, (r) => WEEKDAYS[new Date(`${r.date}T00:00:00Z`).getUTCDay()])
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const biggest = [...rows].sort((a, b) => b.amount_cents - a.amount_cents || a.date.localeCompare(b.date) || a.merchant.localeCompare(b.merchant))[0];
  const mostVisited = [...merchants].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0];
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

  return {
    year,
    currency: 'PHP',
    totalCents,
    transactions: rows.length,
    daysWithSpending: days,
    averagePerDayCents: Math.round(totalCents / (isLeap ? 366 : 365)),
    topMerchants: [...merchants].sort(byTotalThenName).slice(0, 5)
      .map((m) => ({ merchant: m.name, totalCents: m.totalCents, visits: m.count })),
    mostVisited: { merchant: mostVisited.name, visits: mostVisited.count },
    categories: categories.map((c) => ({
      category: c.name,
      totalCents: c.totalCents,
      share: Math.round((c.totalCents / totalCents) * 1000) / 10,
    })),
    biggestMonth: { month: months[0].name, totalCents: months[0].totalCents },
    busiestWeekday: { day: weekdays[0].name, transactions: weekdays[0].count },
    biggestPurchase: { date: biggest.date, merchant: biggest.merchant, amountCents: biggest.amount_cents },
  };
}

export function rebuildSummaries(db, userId) {
  const rows = db.prepare(`
    SELECT date, merchant, category, amount_cents
      FROM transactions
     WHERE user_id = ?
     ORDER BY date, merchant, amount_cents, row_key
  `).all(userId);
  const byYear = new Map();
  for (const r of rows) {
    const year = Number(r.date.slice(0, 4));
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(r);
  }
  db.prepare('DELETE FROM summaries WHERE user_id = ?').run(userId);
  const insert = db.prepare('INSERT INTO summaries (user_id, year, data, fingerprint, built_at) VALUES (?, ?, ?, ?, ?)');
  const builtAt = new Date().toISOString();
  const fingerprints = [];
  for (const year of [...byYear.keys()].sort()) {
    const data = JSON.stringify(buildSummary(year, byYear.get(year)));
    const fingerprint = sha256(data);
    insert.run(userId, year, data, fingerprint, builtAt);
    fingerprints.push(`${year}:${fingerprint}`);
  }
  return combinedFingerprint(fingerprints);
}

export function combinedFingerprint(entries) {
  return sha256(entries.join('\n'));
}

export function readSummaries(db, userId) {
  return db.prepare('SELECT year, data, fingerprint, built_at FROM summaries WHERE user_id = ? ORDER BY year DESC').all(userId)
    .map((r) => ({ ...JSON.parse(r.data), fingerprint: r.fingerprint, builtAt: r.built_at }));
}
