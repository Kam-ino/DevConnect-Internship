# State and Data: Specimen currency converter

A currency converter that fetches live exchange rates from a public API and handles the three non-happy states on purpose: **loading**, **error** and **empty**. Built for the DevConnect frontend track, task "state and data" (brief B: currency converter with live rates).

The result is printed like a **US $100 note, without the portrait**. It borrows the note's arrangement, typography and colours:
- **Layout:** the two currency codes sit in the corners like denominations. The pair runs across the top as the note's title ("US DOLLAR TO EURO"), and the amount you entered runs in engraved capitals across the bottom ("ONE HUNDRED US DOLLARS"). A hatched lathe-work border frames the note.
- **Colour:** the converted amount is struck in colour-shift copper, and the rate and date are printed as green serials.
- **Security details:** a blue security ribbon runs the full height of the note, woven behind the printed lines and carrying the two currency codes. A toothed seal with the target currency sits where the note keeps its seal.

None of the real note's portraits, signatures, official seals, legal wording or serial format are copied.

Below the note, a **rate history chart** shows how the pair has moved over the last month, three months or year, with the change, high and low. While rates load, the note engraves a guilloche rosette (the looping line work on banknotes), generated from the currency pair.

**Stack:** React 19, TypeScript (strict), Vite 8. Fonts are self-hosted through Fontsource and icons come from Phosphor. No backend and no API key.

## Running it

You need Node.js 22.18+ or 24 (`npm test` runs the TypeScript tests directly with Node's built-in type stripping).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests for conversion, parsing, error messages and the history maths
npm run typecheck  # strict TypeScript check
npm run build      # type-checks, then builds to dist/
```

## Seeing each state (no code changes needed)

Open the app, then use the **Check the states** links next to the page heading, or add these to the address:

| State | Address | What you see |
|---|---|---|
| Loading | `/?simulate=slow` | Rates are held back for 5 seconds on every load. The note engraves its rosette, placeholders hold the result's place, and the header says "Loading rates…". Then the chart loads (held 2 more seconds) behind a hatched placeholder. **Refresh rates** shows it again. |
| Error | `/?simulate=error` | The app requests an address on the rate service that doesn't exist, so the **real** error path runs (an HTTP 404). A red "void" note says what failed and what to do, with **Try again**. |
| Empty | `/?from=USD&to=NGN` | The rates load fine, but the European Central Bank doesn't publish a Nigerian naira rate. The note shows an unprinted "watermark window" and says there's no rate for this pair. This is a gap in the data, not an error. |
| Chart error | `/?simulate=chart-error` | The converter works, but the rate history request goes to a missing address, so only the chart panel fails, with its own message and **Try again**. |
| Normal | `/` | Live rates. Add `?range=1y` (or `1m`, `3m`) to open the chart on another period. |

A banner at the top says when a simulation is on, with a link back to live rates.

You can also trigger the real error without the switch: go offline in your browser's DevTools (Network tab), then press **Refresh rates**. The message then says the device is offline.

Any other uncovered currency also gives the empty state. The menus include common currencies the ECB doesn't publish, such as the Kenyan shilling (KES), Egyptian pound (EGP), Argentine peso (ARS) and Vietnamese dong (VND). The address can also preset an amount: `/?from=EUR&to=JPY&amount=250`.

## How the three states differ

| | Loading | Error | Empty |
|---|---|---|---|
| Meaning | The request is in flight | The request failed | The request worked, but there's no rate for the pair |
| Shape | The rosette engraves itself; grey placeholder bars | Red rules on the frame, a "VOID" overprint, no rosette | A blank dashed "watermark window", no rosette |
| Colour | Muted violet and green line work | Serial red | Neutral ink, deliberately not red |
| Heading | "Loading rates" | "Couldn't load exchange rates" | "No rate for this pair" |
| Text | Where the rates are coming from | What failed, why, **what to do** | Which currency has no rate and what to do instead |
| Screen readers | Announced as "Loading exchange rates"; the note is marked busy | Announced immediately (`role="alert"`) | Announced as "No rate for US Dollar (USD) to Nigerian Naira (NGN)" |
| Action | (wait) | **Try again** | Choose another currency |

The states differ by shape and words, not just colour.

### Error messages

Each failure says what failed and what to do:

- **Offline:** the device is offline; reconnect, then try again.
- **No response:** the rate service didn't respond; check your connection and try again.
- **Timeout:** no answer within 10 seconds; try again, or wait a few minutes.
- **HTTP error:** shows the status code (e.g. "404 Not Found", or a 5xx problem on the service's side); try again in a minute.
- **Unreadable data:** the service answered with data in the wrong shape; try again later.

## Rate history chart

Shown under every converted result for a pair the ECB covers.

- **Period:** 1 month, 3 months (the default) or 1 year of daily ECB rates for the pair, cross-calculated through the euro.
- **Reading it:** hover to get a crosshair and a tooltip with the rate and date. With the keyboard, Tab to the chart, then use the Left and Right arrows (Home and End jump to either end); each day is announced to screen readers. The latest rate is labelled at the end of the line.
- **Summary:** the change over the period, plus the high and low with their dates.
- **Table view:** "Show the numbers" opens every day's rate as a table, so nothing is only in the picture.
- **Its own states:** a hatched placeholder on first load. When you switch period, the old line stays on screen, faded, until the new one arrives (no flash). If the request fails, a message says what failed and what to do, with Try again: open `/?simulate=chart-error`, or go offline in DevTools and switch period. A pair with no daily data says "No history for this pair". Pairs with no ECB rate, and same-currency pairs, show no chart.
- **Honest fill:** the hatching runs between the line and the period's opening rate, so it shows the change. The y-axis has round bounds that always contain every point.

## How it works

- `src/rates.ts`: fetches `https://api.frankfurter.dev/v1/latest` once. [Frankfurter](https://frankfurter.dev) republishes the European Central Bank's daily euro reference rates (about 30 currencies, updated around 16:00 CET on working days). Every pair is a cross rate through the euro. A missing currency becomes `{ kind: 'no-rate' }`, never an exception.
- `src/useRates.ts`: a hook that keeps one of three typed states (`loading`, `error`, `ready`), cancels the request on unmount with an `AbortController`, and reloads on demand.
- `src/Note.tsx`: renders the note for each state, with one persistent `role="status"` region so screen readers hear every change.
- `src/useHistory.ts`, `src/History.tsx`, `src/RateChart.tsx`: the rate history request, its panel, and the SVG line chart (drawn from the data, sized with a `ResizeObserver`).
- `src/Rosette.tsx`: generates the loading guilloche from the currency pair (seeded epitrochoid curves in SVG), so each pair gets its own pattern.
- `src/Seal.tsx`: the toothed seal with the target currency (generic geometry, no official emblem).
- `amountInWords` in `src/rates.ts`: writes the amount out in words, as a banknote prints its value ("one thousand two hundred fifty US dollars and 50/100").
- `src/App.tsx`: the form, the URL switches and the "Check the states" section.
- `src/main.tsx`: an error boundary, so a rendering bug shows a message instead of a blank page.

## Accessibility

- Labels on every control, inline validation for the amount (`aria-invalid` plus a message), and full keyboard use.
- State changes are announced: loading, the result, no rate, and errors as alerts.
- WCAG AA contrast in light and dark mode. Dark mode looks like a banknote under UV light.
- Works at 320px wide. Animation is switched off for people who ask for reduced motion.
- The chart can be read with the keyboard, and a full table view sits beside it. Its line colour was checked with a palette validator in both colour schemes.
- Checked with axe-core (WCAG 2.2 AA + best practices): no violations in any of the four states, light and dark, with the chart and its table open.

## Limits

- ECB reference rates are for information only, not for payments or trading, and they don't change at weekends.
- Rates are fetched once per page load (or on **Refresh rates**). The history is fetched again whenever the pair or period changes.

Rates: European Central Bank via Frankfurter (open source, no key).
