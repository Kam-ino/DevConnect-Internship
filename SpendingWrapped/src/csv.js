import { createHash } from 'node:crypto';
import { categorize } from './categorize.js';

export const REQUIRED_COLUMNS = ['date', 'merchant', 'amount'];

const ALIASES = {
  date: ['date', 'transaction date', 'posting date', 'posted', 'posted date'],
  merchant: ['merchant', 'description', 'payee', 'name', 'details', 'particulars'],
  amount: ['amount', 'debit', 'value', 'amount (php)'],
  category: ['category'],
};

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"' && field === '') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

export function mapHeader(header) {
  const names = header.map((h) => h.trim().toLowerCase());
  const index = {};
  for (const [column, aliases] of Object.entries(ALIASES)) {
    const at = names.findIndex((n) => aliases.includes(n));
    if (at !== -1) index[column] = at;
  }
  const missing = REQUIRED_COLUMNS.filter((c) => index[c] === undefined);
  return { index, missing, found: header.map((h) => h.trim()) };
}

export function inspectCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { empty: true, dataRows: 0, missing: REQUIRED_COLUMNS, found: [] };
  const { missing, found } = mapHeader(rows[0]);
  return { empty: rows.length < 2, dataRows: rows.length - 1, missing, found };
}

function parseDate(raw) {
  const s = raw.trim();
  let y;
  let m;
  let d;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [, y, m, d] = match;
  else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, m, d, y] = match;
  else return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
  if (Number(y) < 2000 || Number(y) > 2100) return null;
  return date.toISOString().slice(0, 10);
}

function parseAmount(raw) {
  const s = raw.trim().replace(/^(php|₱)\s*/i, '').replace(/[,\s]/g, '').replace(/^₱/, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

function normalizeRow(cells, index) {
  const get = (column) => (index[column] === undefined ? '' : String(cells[index[column]] ?? ''));
  const date = parseDate(get('date'));
  if (!date) return { error: `date "${get('date').slice(0, 30)}" is not a valid YYYY-MM-DD or MM/DD/YYYY date` };
  const merchant = get('merchant').trim().replace(/\s+/g, ' ');
  if (!merchant) return { error: 'merchant is empty' };
  if (merchant.length > 100) return { error: 'merchant is longer than 100 characters' };
  const amountCents = parseAmount(get('amount'));
  if (amountCents === null) return { error: `amount "${get('amount').slice(0, 30)}" is not a number like 1234.50` };
  if (amountCents <= 0) return { error: 'amount is zero or negative; refunds and income are skipped' };
  if (amountCents > 100_000_000_00) return { error: 'amount is larger than 100,000,000' };
  return { date, merchant, amountCents, category: categorize(merchant, get('category')) };
}

export function prepareRows(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error('the file is empty');
  const { index, missing } = mapHeader(rows[0]);
  if (missing.length) throw new Error(`missing columns: ${missing.join(', ')}`);
  const seen = new Map();
  return rows.slice(1).map((cells, i) => {
    const n = i + 1;
    const row = normalizeRow(cells, index);
    if (row.error) return { n, error: row.error };
    const identity = `${row.date}|${row.merchant.toLowerCase()}|${row.amountCents}`;
    const occurrence = (seen.get(identity) || 0) + 1;
    seen.set(identity, occurrence);
    const key = createHash('sha256').update(`${identity}|${occurrence}`).digest('hex').slice(0, 32);
    return { n, key, ...row };
  });
}
