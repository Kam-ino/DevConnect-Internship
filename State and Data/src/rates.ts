// Exchange rates from Frankfurter, which republishes the European Central Bank's daily reference rates.
const API = 'https://api.frankfurter.dev/v1';
export const RATES_URL = `${API}/latest`;

// Used by ?simulate=error: a real request to an address that doesn't exist, so the genuine error path runs.
export const BROKEN_URL = `${API}/no-such-endpoint`;

const TIMEOUT_MS = 10_000;

// Currencies offered in the menus. The ECB covers about 30 of them; the rest are widely used
// currencies it doesn't publish, so "no rate for this pair" is a normal outcome, not a fault.
export const CURRENCIES = [
  'AED', 'ARS', 'AUD', 'BDT', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'COP', 'CZK', 'DKK', 'EGP', 'EUR',
  'GBP', 'GHS', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KES', 'KRW', 'MAD', 'MXN', 'MYR',
  'NGN', 'NOK', 'NZD', 'PEN', 'PHP', 'PKR', 'PLN', 'QAR', 'RON', 'SAR', 'SEK', 'SGD', 'THB', 'TRY',
  'TWD', 'UAH', 'USD', 'VND', 'ZAR',
];

export interface RateTable {
  date: string; // ECB publication date, YYYY-MM-DD
  perEuro: Record<string, number>; // units of each currency per 1 euro, EUR included
}

export type RatesErrorKind = 'offline' | 'network' | 'timeout' | 'http' | 'invalid';

export class RatesError extends Error {
  readonly kind: RatesErrorKind;
  readonly status: number | undefined;

  constructor(kind: RatesErrorKind, status?: number) {
    super(`Rates request failed: ${kind}${status ? ` ${status}` : ''}`);
    this.kind = kind;
    this.status = status;
  }
}

export function parseRates(body: unknown): RateTable {
  if (typeof body !== 'object' || body === null) throw new RatesError('invalid');
  const { base, date, rates } = body as Record<string, unknown>;
  if (base !== 'EUR' || typeof date !== 'string' || typeof rates !== 'object' || rates === null) {
    throw new RatesError('invalid');
  }
  const perEuro: Record<string, number> = { EUR: 1 };
  for (const [code, value] of Object.entries(rates)) {
    if (typeof value === 'number' && value > 0) perEuro[code] = value;
  }
  return { date, perEuro };
}

export async function fetchRates(url: string, signal: AbortSignal): Promise<RateTable> {
  return parseRates(await fetchJson(url, signal));
}

// One request with a timeout; every way it can fail becomes a RatesError the UI can explain.
async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) });
  } catch (error) {
    if (signal.aborted) throw error; // the caller cancelled; nothing to report
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new RatesError('timeout');
    throw new RatesError(navigator.onLine === false ? 'offline' : 'network');
  }
  if (!response.ok) throw new RatesError('http', response.status);

  try {
    return await response.json();
  } catch {
    throw new RatesError('invalid');
  }
}

// ---- Rate history ----

export interface RatePoint {
  date: string; // YYYY-MM-DD
  rate: number; // units of `to` per 1 `from`
}

export const RANGES = [
  { id: '1m', label: '1 month', months: 1 },
  { id: '3m', label: '3 months', months: 3 },
  { id: '1y', label: '1 year', months: 12 },
] as const;
export type RangeId = (typeof RANGES)[number]['id'];

// The daily series for a pair, ending on the latest ECB date. null when there's nothing to chart.
export function historyUrl(from: string, to: string, endDate: string, months: number): string | null {
  if (from === to) return null;
  const end = new Date(`${endDate}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - months);
  const symbols = [from, to].filter((code) => code !== 'EUR').join(',');
  return `${API}/${start.toISOString().slice(0, 10)}..${endDate}?symbols=${symbols}`;
}

export function parseHistory(body: unknown, from: string, to: string): RatePoint[] {
  if (typeof body !== 'object' || body === null) throw new RatesError('invalid');
  const { base, rates } = body as Record<string, unknown>;
  if (base !== 'EUR' || typeof rates !== 'object' || rates === null) throw new RatesError('invalid');
  const points: RatePoint[] = [];
  for (const [date, day] of Object.entries(rates)) {
    if (typeof day !== 'object' || day === null) continue;
    const perEuro: Record<string, unknown> = { EUR: 1, ...day };
    const fromRate = perEuro[from];
    const toRate = perEuro[to];
    if (typeof fromRate === 'number' && typeof toRate === 'number' && fromRate > 0) {
      points.push({ date, rate: toRate / fromRate });
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchHistory(url: string, from: string, to: string, signal: AbortSignal): Promise<RatePoint[]> {
  return parseHistory(await fetchJson(url, signal), from, to);
}

// First, last, highest and lowest point, and the change across the period. Needs at least one point.
export function summarize(points: RatePoint[]) {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let high = first;
  let low = first;
  for (const point of points) {
    if (point.rate > high.rate) high = point;
    if (point.rate < low.rate) low = point;
  }
  return { first, last, high, low, change: (last.rate - first.rate) / first.rate };
}

// A tidy axis for data spanning [min, max]: round bounds that contain every point,
// with evenly spaced ticks in steps of 1, 2 or 5 x 10^n.
export function niceScale(min: number, max: number, count = 4) {
  const raw = (max - min) / count || Math.abs(max) / 10 || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw * (1 - 1e-9)) ?? 10 * power;
  const ticks: number[] = [];
  const last = Math.ceil(max / step - 1e-9);
  for (let i = Math.floor(min / step + 1e-9); i <= last; i++) ticks.push(Number((i * step).toPrecision(12)));
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); // every label at the same precision
  return { low: ticks[0]!, high: ticks[ticks.length - 1]!, ticks, decimals };
}

const monthLabel = (isoDate: string, withYear: boolean) =>
  utc(isoDate).toLocaleDateString('en-GB', { month: 'short', ...(withYear && { year: 'numeric' }), timeZone: 'UTC' });

// Date ticks for the x axis: the first day of each month ("Aug"), or of each week for short ranges
// ("7 Sep"), thinned so at most `slots` labels fit. When the range spans years, the first label
// shown in each year carries it ("Nov 2025", "Jan 2026"), even if thinning dropped January.
export function timeTicks(points: RatePoint[], slots: number): { index: number; label: string }[] {
  const starts = (isNew: (date: string, previous: string) => boolean) =>
    points.flatMap((point, i) => (i > 0 && isNew(point.date, points[i - 1]!.date) ? [i] : []));
  let label = monthLabel;
  let marks = starts((date, previous) => date.slice(0, 7) !== previous.slice(0, 7));
  if (marks.length < 3) {
    label = formatShortDate;
    marks = starts((date, previous) => utc(date).getUTCDay() < utc(previous).getUTCDay());
  }
  const every = Math.ceil(marks.length / Math.max(1, slots));
  const crossesYear = spansYears(points);
  let year = '';
  return marks.filter((_, k) => k % every === 0).map((index) => {
    const date = points[index]!.date;
    const withYear = crossesYear && date.slice(0, 4) !== year;
    year = date.slice(0, 4);
    return { index, label: label(date, withYear) };
  });
}

// ---- Amounts in words, the way a banknote prints its value ----

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const restWords = rest < 20 ? ONES[rest]! : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`;
  if (!hundreds) return restWords;
  return `${ONES[hundreds]} hundred${rest ? ` ${restWords}` : ''}`;
}

export function numberToWords(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  for (const [size, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand'], [1, '']] as const) {
    const chunk = Math.floor(n / size) % 1000;
    if (chunk) parts.push(name ? `${belowThousand(chunk)} ${name}` : belowThousand(chunk));
  }
  return parts.join(' ');
}

// "one hundred US dollars", "one thousand two hundred fifty US dollars and 50/100".
// null past a trillion, where words stop helping.
export function amountInWords(value: number, code: string): string | null {
  const digits = fractionDigits(code);
  const total = Math.round(value * 10 ** digits);
  const whole = Math.floor(total / 10 ** digits);
  const fraction = total % 10 ** digits;
  if (whole >= 1e12) return null;
  // No decimals here: "1.00" counts as plural in English, so it would print "one euros"
  const name = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'name', minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .formatToParts(whole === 1 && !fraction ? 1 : 2)
    .find((part) => part.type === 'currency')?.value ?? code;
  const cents = fraction ? ` and ${String(fraction).padStart(digits, '0')}/${10 ** digits}` : '';
  return `${numberToWords(whole)} ${name}${cents}`;
}

export type Conversion =
  | { kind: 'converted'; amount: number; rate: number }
  | { kind: 'no-rate'; missing: string[] };

// Every pair is a cross rate through the euro: from -> EUR -> to.
// A currency the source doesn't publish is a gap in the data, reported as such, never as an error.
export function convert(amount: number, from: string, to: string, table: RateTable): Conversion {
  const fromRate = table.perEuro[from];
  const toRate = table.perEuro[to];
  if (fromRate === undefined || toRate === undefined) {
    const missing = [...new Set([from, to])].filter((code) => table.perEuro[code] === undefined);
    return { kind: 'no-rate', missing };
  }
  const rate = toRate / fromRate;
  return { kind: 'converted', amount: amount * rate, rate };
}

// Accepts "1,250.50" or " 99 "; returns null for anything that isn't a plain non-negative number.
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s,]/g, '');
  return /^(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : null;
}

// What failed, why (when we know), and what to do next.
export function describeError(error: RatesError): { what: string; why: string; next: string } {
  switch (error.kind) {
    case 'offline':
      return {
        what: 'Couldn’t load exchange rates',
        why: 'Your device is offline, so the request to the rate service never left.',
        next: 'Reconnect to the internet, then try again.',
      };
    case 'timeout':
      return {
        what: 'Couldn’t load exchange rates',
        why: `The rate service (Frankfurter) didn’t answer within ${TIMEOUT_MS / 1000} seconds.`,
        next: 'Try again. If it keeps timing out, the service is probably busy; wait a few minutes.',
      };
    case 'http':
      return {
        what: 'Couldn’t load exchange rates',
        why:
          error.status === 404
            ? 'The rate service (Frankfurter) answered “404 Not Found”: the address the app asked for doesn’t exist.'
            : error.status !== undefined && error.status >= 500
              ? `The rate service (Frankfurter) had a problem on its side (error ${error.status}).`
              : `The rate service (Frankfurter) refused the request (error ${error.status}).`,
        next: 'Try again in a minute. If it keeps failing, the service may have moved or be down.',
      };
    case 'invalid':
      return {
        what: 'Couldn’t read the exchange rates',
        why: 'The rate service answered, but the data wasn’t in the expected format.',
        next: 'Try again later. Nothing you entered caused this.',
      };
    default:
      return {
        what: 'Couldn’t load exchange rates',
        why: 'The request to the rate service (Frankfurter) didn’t get a response. It may be down, or blocked on this network.',
        next: 'Check your connection and try again.',
      };
  }
}

const names = new Intl.DisplayNames(['en'], { type: 'currency' });
export const currencyName = (code: string) => names.of(code) ?? code;

const fractionDigits = (code: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;

// An amount with the currency's usual decimals and no symbol, e.g. "8,612.73" or "15,980" (JPY).
export const formatAmount = (value: number, code: string) => {
  const digits = fractionDigits(code);
  return new Intl.NumberFormat('en', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
};

export const formatRate = (rate: number) => new Intl.NumberFormat('en', { maximumSignificantDigits: 6 }).format(rate);

const utc = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

export const formatDate = (isoDate: string) =>
  utc(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// "3 Jul" for axis labels and the high/low line; "3 Jul 2025" when a range crosses a year
export const formatShortDate = (isoDate: string, withYear = false) =>
  utc(isoDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear && { year: 'numeric' }), timeZone: 'UTC' });

export const spansYears = (points: RatePoint[]) => points[0]?.date.slice(0, 4) !== points[points.length - 1]?.date.slice(0, 4);

// The publication date as a banknote serial, e.g. "02 OCT 2026"
export const formatSerialDate = (isoDate: string) =>
  utc(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase();

export const formatChange = (change: number) =>
  new Intl.NumberFormat('en', { style: 'percent', signDisplay: 'exceptZero', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(change);
