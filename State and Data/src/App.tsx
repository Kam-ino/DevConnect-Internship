import { useState } from 'react';
import { ArrowsLeftRight } from '@phosphor-icons/react';
import History from './History.tsx';
import Note from './Note.tsx';
import { useHistory } from './useHistory.ts';
import { useRates } from './useRates.ts';
import {
  BROKEN_URL, CURRENCIES, RANGES, RATES_URL, currencyName, formatSerialDate, historyUrl, parseAmount, type RangeId,
} from './rates.ts';

// Reviewer switches, read once from the address bar (documented in the README):
//   ?simulate=slow         holds the loading state for 5 seconds on every load
//   ?simulate=error        requests an address that doesn't exist, so the real error path runs
//   ?simulate=chart-error  the same, for the rate history only
//   ?from=USD&to=NGN&amount=250   opens with that pair and amount (USD to NGN has no ECB rate)
//   ?range=1m|3m|1y        opens the rate history on that period
const params = new URLSearchParams(window.location.search);
const simulate = params.get('simulate');
const SIMULATIONS: Record<string, string> = {
  slow: 'Simulating a slow connection: rates arrive after 5 seconds.',
  error: 'Simulating a failure: the app is asking the rate service for an address that doesn’t exist.',
  'chart-error': 'Simulating a failure in the rate history only: the chart asks for an address that doesn’t exist.',
};
const simulation = simulate ? SIMULATIONS[simulate] : undefined;

const OPTIONS = [...CURRENCIES].sort((a, b) => currencyName(a).localeCompare(currencyName(b)));
const initialCode = (key: string, fallback: string) => {
  const code = params.get(key)?.toUpperCase();
  return code && CURRENCIES.includes(code) ? code : fallback;
};

const STATE_LINKS = [
  { href: '?simulate=slow', label: 'Loading' },
  { href: '?simulate=error', label: 'Error' },
  { href: '?from=USD&to=NGN', label: 'Empty (no rate)' },
  { href: '?simulate=chart-error', label: 'Chart error' },
  { href: './', label: 'Live rates' },
];

export default function App() {
  const [rates, reload] = useRates(simulate === 'error' ? BROKEN_URL : RATES_URL, simulate === 'slow' ? 5000 : 0);
  const [amountText, setAmountText] = useState(params.get('amount') ?? '100');
  const [from, setFrom] = useState(() => initialCode('from', 'USD'));
  const [to, setTo] = useState(() => initialCode('to', 'EUR'));

  const [range, setRange] = useState<RangeId>(() => RANGES.find((option) => option.id === params.get('range'))?.id ?? '3m');

  const amount = parseAmount(amountText);
  // An empty field is a prompt (the note asks for an amount), not a fault; only unreadable input is an error.
  const amountError = amountText.trim() !== '' && amount === null ? 'Enter a number, like 250 or 99.95' : '';

  // History is only fetched for a pair the source covers; a gap has nothing to chart.
  const covered = rates.status === 'ready' && rates.table.perEuro[from] !== undefined && rates.table.perEuro[to] !== undefined;
  const months = RANGES.find((option) => option.id === range)?.months ?? 3;
  const pairUrl = covered ? historyUrl(from, to, rates.table.date, months) : null;
  const chartUrl = pairUrl && simulate === 'chart-error' ? BROKEN_URL : pairUrl;
  const [history, retryHistory] = useHistory(chartUrl, from, to, simulate === 'slow' ? 2000 : 0);

  const statusLine =
    rates.status === 'ready' ? <>ECB reference rates, <span className="figures">{formatSerialDate(rates.table.date)}</span></>
      : rates.status === 'loading' ? 'Loading rates…'
        : 'Rates unavailable';

  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>

      <header>
        <div className="band">
          <div className="wrap band-inner">
            <a className="brand" href="./">Specimen</a>
            <p className="band-status">{statusLine}</p>
          </div>
        </div>
        {simulation && (
          <div className="simulation">
            <p className="wrap">
              {simulation} <a href="./">Use live rates</a>
            </p>
          </div>
        )}
      </header>

      <main id="main" className="wrap">
        <div className="title-row">
          <h1>Currency converter</h1>

          <section className="states" aria-labelledby="states-title">
            <h2 id="states-title">Check the states</h2>
            <ul role="list">
              {STATE_LINKS.map(({ href, label }) => (
                <li key={label}>
                  <a className="state-link" href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="workspace">
          <form className="converter" aria-label="Conversion" onSubmit={(event) => event.preventDefault()}>
            <div className="field">
              <label htmlFor="amount">Amount</label>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                aria-invalid={amountError ? 'true' : undefined}
                aria-describedby="amount-error"
              />
              <p className="error" id="amount-error">{amountError}</p>
            </div>

            <div className="pair">
              <div className="field">
                <label htmlFor="from">From</label>
                <select id="from" value={from} onChange={(event) => setFrom(event.target.value)}>
                  {OPTIONS.map((code) => (
                    <option key={code} value={code}>{currencyName(code)} ({code})</option>
                  ))}
                </select>
              </div>

              <button className="swap" type="button" onClick={() => { setFrom(to); setTo(from); }}>
                <ArrowsLeftRight aria-hidden="true" /> Swap
              </button>

              <div className="field">
                <label htmlFor="to">To</label>
                <select id="to" value={to} onChange={(event) => setTo(event.target.value)}>
                  {OPTIONS.map((code) => (
                    <option key={code} value={code}>{currencyName(code)} ({code})</option>
                  ))}
                </select>
              </div>
            </div>
          </form>

          <Note rates={rates} amount={amount} from={from} to={to} onReload={reload} />
        </div>

        {chartUrl && (
          <History history={history} from={from} to={to} range={range} onRange={setRange} onRetry={retryHistory} />
        )}
      </main>

      <footer className="wrap site-footer">
        <p>
          Rates are the European Central Bank’s euro reference rates, published once per working day and served by{' '}
          <a href="https://frankfurter.dev">Frankfurter</a>. Other pairs are worked out through the euro. They’re for
          information only, not for payments.
        </p>
      </footer>
    </>
  );
}
