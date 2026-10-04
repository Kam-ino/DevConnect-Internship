import { useCallback, useEffect, useState } from 'react';
import { RatesError, fetchHistory, type RatePoint } from './rates.ts';

export type HistoryState =
  | { status: 'idle' }
  | { status: 'loading'; previous: RatePoint[] | null } // previous: the last chart, kept on screen while refetching
  | { status: 'error'; error: RatesError }
  | { status: 'ready'; points: RatePoint[] };

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(signal.reason);
    }, { once: true });
  });

// Loads the daily series for a pair. `url` is null when there's nothing to chart.
export function useHistory(url: string | null, from: string, to: string, delayMs = 0) {
  const [state, setState] = useState<HistoryState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setState((current) => ({
      status: 'loading',
      previous: current.status === 'ready' ? current.points : current.status === 'loading' ? current.previous : null,
    }));
    (async () => {
      try {
        if (delayMs) await wait(delayMs, controller.signal);
        const points = await fetchHistory(url, from, to, controller.signal);
        setState({ status: 'ready', points });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ status: 'error', error: error instanceof RatesError ? error : new RatesError('network') });
      }
    })();
    return () => controller.abort();
  }, [url, from, to, delayMs, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return [url ? state : ({ status: 'idle' } as const), retry] as const;
}
