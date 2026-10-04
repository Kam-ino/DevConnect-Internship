import { useCallback, useEffect, useState } from 'react';
import { RatesError, fetchRates, type RateTable } from './rates.ts';

export type RatesState =
  | { status: 'loading' }
  | { status: 'error'; error: RatesError }
  | { status: 'ready'; table: RateTable };

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(signal.reason);
    }, { once: true });
  });

// Loads the rate table once, and again whenever reload() is called.
// `delayMs` holds the loading state on purpose (the ?simulate=slow switch).
export function useRates(url: string, delayMs = 0) {
  const [state, setState] = useState<RatesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        if (delayMs) await wait(delayMs, controller.signal);
        const table = await fetchRates(url, controller.signal);
        setState({ status: 'ready', table });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ status: 'error', error: error instanceof RatesError ? error : new RatesError('network') });
      }
    })();
    return () => controller.abort();
  }, [url, delayMs, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return [state, reload] as const;
}
