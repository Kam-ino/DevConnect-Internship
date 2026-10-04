import type { ReactNode } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import Rosette from './Rosette.tsx';
import Seal from './Seal.tsx';
import type { RatesState } from './useRates.ts';
import { amountInWords, convert, currencyName, describeError, formatAmount, formatRate, formatSerialDate } from './rates.ts';

interface NoteProps {
  rates: RatesState;
  amount: number | null;
  from: string;
  to: string;
  onReload: () => void;
}

const named = (code: string) => `${currencyName(code)} (${code})`;

// Fine repeated text along the frame, as on a banknote. Decorative: the same facts are printed in full.
const Microprint = () => (
  <span className="microprint" aria-hidden="true">
    {'EUROPEAN CENTRAL BANK REFERENCE RATE FOR INFORMATION ONLY '.repeat(12)}
  </span>
);

// The result panel, printed like a banknote (after the US $100 note's layout, with no portrait).
// Its looks are deliberately different shapes: an engraving rosette (loading), the printed note
// (result), a blank watermark window (no rate) and a red void overprint (error), so the states
// never depend on colour alone.
export default function Note(props: NoteProps) {
  const { panel, announcement } = renderPanel(props);
  return (
    <>
      {panel}
      {/* One status region that stays on the page, so screen readers hear each change of state */}
      <p className="visually-hidden" role="status">{announcement}</p>
    </>
  );
}

function renderPanel({ rates, amount, from, to, onReload }: NoteProps): { panel: ReactNode; announcement: string } {
  const pair = `${from}-${to}`;

  if (rates.status === 'error') {
    const { what, why, next } = describeError(rates.error);
    return {
      announcement: '',
      panel: (
        <section className="note note-error" role="alert" aria-labelledby="note-title">
          <span className="void-mark" aria-hidden="true">Void</span>
          <h2 className="note-title" id="note-title">{what}</h2>
          <p>{why}</p>
          <p><strong>What to do:</strong> {next}</p>
          <button className="button" type="button" onClick={onReload}>
            <ArrowClockwise aria-hidden="true" weight="bold" /> Try again
          </button>
        </section>
      ),
    };
  }

  if (rates.status === 'loading') {
    return {
      announcement: 'Loading exchange rates',
      panel: (
        <section className="note note-loading" aria-labelledby="note-title" aria-busy="true">
          <Rosette seed={pair} engraving="loop" layers={1} />
          <div className="note-body">
            <h2 className="note-title" id="note-title">Loading rates</h2>
            <p>Fetching today’s reference rates from the European Central Bank.</p>
            <span className="skeleton" aria-hidden="true" />
            <span className="skeleton short" aria-hidden="true" />
          </div>
        </section>
      ),
    };
  }

  const { table } = rates;
  const source = (
    <p className="note-source">
      ECB reference rate <time className="serial" dateTime={table.date}>{formatSerialDate(table.date)}</time>
    </p>
  );
  const result = convert(amount ?? 0, from, to, table);

  if (result.kind === 'no-rate') {
    const gaps = result.missing.map(named).join(' or ');
    return {
      announcement: `No rate for ${named(from)} to ${named(to)}`,
      panel: (
        <section className="note note-empty" aria-labelledby="note-title">
          <div className="watermark" aria-hidden="true">
            <span>No rate</span>
          </div>
          <div className="note-body">
            <h2 className="note-title" id="note-title">No rate for this pair</h2>
            <p>The rates loaded, but the European Central Bank doesn’t publish a rate for {gaps}, so there’s nothing to convert with.</p>
            <p>Choose another currency, or check a bank or payment provider for {result.missing.join(' and ')}.</p>
            {source}
          </div>
          <Microprint />
        </section>
      ),
    };
  }

  if (amount === null) {
    return {
      announcement: '',
      panel: (
        <section className="note note-idle" aria-labelledby="note-title">
          <Rosette seed={pair} />
          <div className="note-body">
            <h2 className="note-title" id="note-title">Enter an amount</h2>
            <p>Type an amount to see it in {named(to)}.</p>
            {source}
          </div>
          <Microprint />
        </section>
      ),
    };
  }

  const fromText = `${formatAmount(amount, from)} ${from}`;
  const words = amountInWords(amount, from);
  return {
    announcement: `${fromText} is ${formatAmount(result.amount, to)} ${to}`,
    panel: (
      <section className="note note-ready" aria-labelledby="note-title">
        {/* Corner denominations, as on a banknote: the two codes, the last one in colour-shift copper */}
        <span className="corner corner-tl" aria-hidden="true">{from}</span>
        <span className="corner corner-tr" aria-hidden="true">{to}</span>
        <span className="corner corner-bl" aria-hidden="true">{from}</span>
        <span className="corner corner-br" aria-hidden="true">{to}</span>
        {/* The note's title line across the top, and its value in words across the bottom.
            Both repeat what the figures say, so they're hidden from assistive tech. */}
        <p className="note-heading" aria-hidden="true"><span>{currencyName(from)} to {currencyName(to)}</span></p>
        {/* The security ribbon runs the full height, woven behind the two printed lines */}
        <span className="ribbon" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => <span key={i} className={i % 2 ? 'ribbon-alt' : undefined}>{i % 2 ? from : to}</span>)}
        </span>
        <div className="bill-face">
          <div className="note-body">
            <h2 className="visually-hidden" id="note-title">Result</h2>
            <p className="note-from"><span className="figures">{fromText}</span> is</p>
            <p className="note-amount">
              {formatAmount(result.amount, to)} <span className="note-code">{to}</span>
            </p>
            <p className="note-rate">1 {from} = {formatRate(result.rate)} {to}</p>
            <p className="note-source">
              ECB reference rate <time className="serial" dateTime={table.date}>{formatSerialDate(table.date)}</time>
            </p>
            <button className="button button-quiet" type="button" onClick={onReload}>
              <ArrowClockwise aria-hidden="true" /> Refresh rates
            </button>
          </div>
          <span className="ribbon-slot" aria-hidden="true" />
          <Seal code={to} />
        </div>
        {words && <p className="note-words" aria-hidden="true"><span>{words}</span></p>}
        <Microprint />
      </section>
    ),
  };
}
