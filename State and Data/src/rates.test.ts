import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RatesError, amountInWords, convert, describeError, formatAmount, formatChange, formatShortDate, historyUrl, niceScale, numberToWords,
  parseAmount, parseHistory, parseRates, spansYears, summarize, timeTicks,
} from './rates.ts';

const table = parseRates({ amount: 1, base: 'EUR', date: '2026-10-02', rates: { USD: 1.16, JPY: 172.5, GBP: 0.85 } });

test('reads the Frankfurter payload and adds the euro itself', () => {
  assert.deepEqual(table, { date: '2026-10-02', perEuro: { EUR: 1, USD: 1.16, JPY: 172.5, GBP: 0.85 } });
  assert.throws(() => parseRates({ base: 'USD', date: '2026-10-02', rates: {} }), RatesError);
  assert.throws(() => parseRates('not json'), RatesError);
});

test('converts through the euro', () => {
  const result = convert(100, 'USD', 'GBP', table);
  assert.equal(result.kind, 'converted');
  if (result.kind === 'converted') {
    assert.ok(Math.abs(result.rate - 0.85 / 1.16) < 1e-12);
    assert.ok(Math.abs(result.amount - 73.2759) < 1e-4);
  }
  assert.deepEqual(convert(5, 'EUR', 'EUR', table), { kind: 'converted', amount: 5, rate: 1 });
});

test('a currency the source does not cover is a gap, not an error', () => {
  assert.deepEqual(convert(100, 'USD', 'NGN', table), { kind: 'no-rate', missing: ['NGN'] });
  assert.deepEqual(convert(100, 'KES', 'NGN', table), { kind: 'no-rate', missing: ['KES', 'NGN'] });
  assert.deepEqual(convert(100, 'NGN', 'NGN', table), { kind: 'no-rate', missing: ['NGN'] });
});

test('amounts are parsed leniently but strictly', () => {
  assert.equal(parseAmount('1,250.50'), 1250.5);
  assert.equal(parseAmount(' 99 '), 99);
  assert.equal(parseAmount('.5'), 0.5);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('-4'), null);
  assert.equal(parseAmount('12abc'), null);
  assert.equal(parseAmount('0x10'), null);
});

test('every error says what failed and what to do', () => {
  for (const error of [new RatesError('offline'), new RatesError('network'), new RatesError('timeout'), new RatesError('http', 404), new RatesError('http', 503), new RatesError('invalid')]) {
    const { what, why, next } = describeError(error);
    assert.ok(what && why && next);
  }
  assert.match(describeError(new RatesError('http', 404)).why, /404/);
  assert.match(describeError(new RatesError('http', 503)).why, /503/);
});

test('history asks for the pair over the chosen months, ending on the ECB date', () => {
  assert.equal(historyUrl('USD', 'JPY', '2026-10-02', 3), 'https://api.frankfurter.dev/v1/2026-07-02..2026-10-02?symbols=USD,JPY');
  assert.equal(historyUrl('EUR', 'GBP', '2026-10-02', 12), 'https://api.frankfurter.dev/v1/2025-10-02..2026-10-02?symbols=GBP');
  assert.equal(historyUrl('USD', 'USD', '2026-10-02', 1), null);
});

test('history becomes a sorted cross-rate series', () => {
  const body = { base: 'EUR', rates: { '2026-10-02': { USD: 1.2, GBP: 0.9 }, '2026-10-01': { USD: 1, GBP: 0.8 }, '2026-09-30': { GBP: 0.8 } } };
  assert.deepEqual(parseHistory(body, 'USD', 'GBP').map((p) => [p.date, Number(p.rate.toFixed(4))]), [
    ['2026-10-01', 0.8],
    ['2026-10-02', 0.75],
  ]);
  assert.deepEqual(parseHistory(body, 'EUR', 'GBP').length, 3);
  assert.throws(() => parseHistory({ base: 'EUR' }, 'USD', 'GBP'), RatesError);
});

test('history summary and axis ticks', () => {
  const points = [{ date: 'a', rate: 1 }, { date: 'b', rate: 1.3 }, { date: 'c', rate: 0.9 }, { date: 'd', rate: 1.1 }];
  const s = summarize(points);
  assert.deepEqual([s.high.date, s.low.date, s.last.date], ['b', 'c', 'd']);
  assert.ok(Math.abs(s.change - 0.1) < 1e-12);
  assert.equal(formatChange(0.1), '+10.0%');
  // The axis always contains the data: the latest and lowest values sit inside the labelled range.
  assert.deepEqual(niceScale(0.854774, 0.890869), { low: 0.85, high: 0.9, ticks: [0.85, 0.86, 0.87, 0.88, 0.89, 0.9], decimals: 2 });
  assert.deepEqual(niceScale(150, 172).ticks, [150, 160, 170, 180]); // 22 / 4 = 5.5, so the step rounds up to 10
  assert.equal(niceScale(150, 172).decimals, 0);
});

test('date ticks fall on month starts, or week starts for short ranges', () => {
  const days = (from: string, count: number) =>
    Array.from({ length: count }, (_, i) => ({ date: new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), rate: 1 }));
  const quarter = days('2026-07-02', 93);
  // en-GB writes September as "Sept" in current ICU data, so that label comes from Intl itself
  const september = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, 8, 1));
  assert.deepEqual(timeTicks(quarter, 10).map((t) => t.label), ['Aug', september, 'Oct']);
  const year = days('2025-10-02', 366);
  assert.ok(timeTicks(year, 20).some((t) => t.label === 'Jan 2026'));
  assert.ok(timeTicks(year, 4).length <= 4);
  // Thinned to two labels (a phone), both years are still named
  assert.deepEqual(timeTicks(year, 2).map((t) => t.label.slice(-4)), ['2025', '2026']);
  const month = days('2026-09-03', 30); // one month start only, so weeks are used
  assert.ok(timeTicks(month, 10).length >= 3);
});

test('dates carry the year once a range crosses into a new year', () => {
  assert.equal(spansYears([{ date: '2025-10-02', rate: 1 }, { date: '2026-10-02', rate: 1 }]), true);
  assert.equal(spansYears([{ date: '2026-07-02', rate: 1 }, { date: '2026-10-02', rate: 1 }]), false);
  assert.equal(formatShortDate('2025-10-02', true), '2 Oct 2025');
  assert.equal(formatShortDate('2026-07-03'), '3 Jul');
});

test('amounts in words, as a banknote prints them', () => {
  assert.equal(numberToWords(21), 'twenty-one');
  assert.equal(numberToWords(1_250_000), 'one million two hundred fifty thousand');
  assert.equal(amountInWords(100, 'USD'), 'one hundred US dollars');
  assert.equal(amountInWords(1, 'EUR'), 'one euro');
  assert.equal(amountInWords(1250.5, 'USD'), 'one thousand two hundred fifty US dollars and 50/100');
  assert.equal(amountInWords(15980, 'JPY'), 'fifteen thousand nine hundred eighty Japanese yen');
  assert.equal(amountInWords(99.999, 'USD'), 'one hundred US dollars');
  assert.equal(amountInWords(2e12, 'USD'), null);
});

test('amounts use each currency’s usual decimals', () => {
  assert.equal(formatAmount(8612.734, 'EUR'), '8,612.73');
  assert.equal(formatAmount(15980.4, 'JPY'), '15,980');
});
