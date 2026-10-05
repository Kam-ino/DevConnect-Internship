import type { ChangeEvent } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import RateChart from './RateChart.tsx';
import type { HistoryState } from './useHistory.ts';
import { RANGES, describeError, formatChange, formatDate, formatRate, formatShortDate, spansYears, summarize, type RangeId } from './rates.ts';

interface HistoryProps {
  history: HistoryState;
  from: string;
  to: string;
  range: RangeId;
  onRange: (range: RangeId) => void;
  onRetry: () => void;
}

// Rate history for the pair: a period switch, the chart, its summary and a table of every day.
// It has its own loading, error and empty states, separate from the converter's.
export default function History({ history, from, to, range, onRange, onRetry }: HistoryProps) {
  const period = RANGES.find((option) => option.id === range)?.label ?? '';
  const handleRange = (event: ChangeEvent<HTMLInputElement>) => onRange(event.target.value as RangeId);

  return (
    <section className="history" aria-labelledby="history-title" aria-busy={history.status === 'loading'}>
      <div className="history-head">
        <div>
          <h2 id="history-title">Rate history</h2>
          <p className="history-sub">Daily ECB rates for 1 {from} in {to}, over {period}</p>
        </div>
        <fieldset className="range">
          <legend className="visually-hidden">Period</legend>
          {RANGES.map((option) => (
            <label key={option.id} className="range-option">
              <input type="radio" name="range" value={option.id} checked={range === option.id} onChange={handleRange} />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <HistoryBody history={history} from={from} to={to} period={period} onRetry={onRetry} />
    </section>
  );
}

function HistoryBody({ history, from, to, period, onRetry }: Omit<HistoryProps, 'range' | 'onRange'> & { period: string }) {
  if (history.status === 'loading') {
    return history.previous ? (
      <>
        <RateChart points={history.previous} from={from} to={to} dimmed />
        <p className="history-note">Loading {period} of rates…</p>
      </>
    ) : (
      <>
        <div className="chart-skeleton" aria-hidden="true" />
        <p className="history-note">Loading {period} of rates…</p>
      </>
    );
  }

  if (history.status === 'error') {
    const { why, next } = describeError(history.error);
    return (
      <div className="history-error" role="alert">
        <p><strong>Couldn’t load the rate history.</strong> {why}</p>
        <p><strong>What to do:</strong> {next}</p>
        <button className="button button-quiet" type="button" onClick={onRetry}>
          <ArrowClockwise aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  if (history.status === 'idle') return null;

  const { points } = history;
  if (points.length < 2) {
    return <p className="history-note">No history for this pair in the last {period}.</p>;
  }

  const { high, low, change } = summarize(points);
  const withYear = spansYears(points);
  return (
    <>
      <RateChart points={points} from={from} to={to} />
      <dl className="history-stats">
        <div>
          <dt>Change</dt>
          <dd>{formatChange(change)} <span>from {formatRate(points[0]!.rate)}</span></dd>
        </div>
        <div>
          <dt>High</dt>
          <dd>{formatRate(high.rate)} <span>on {formatShortDate(high.date, withYear)}</span></dd>
        </div>
        <div>
          <dt>Low</dt>
          <dd>{formatRate(low.rate)} <span>on {formatShortDate(low.date, withYear)}</span></dd>
        </div>
      </dl>
      <details className="history-table">
        <summary>Show the numbers</summary>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={`Daily rates, ${from} to ${to}`}>
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">1 {from} in {to}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((point) => (
                <tr key={point.date}>
                  <th scope="row">{formatDate(point.date)}</th>
                  <td>{formatRate(point.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
