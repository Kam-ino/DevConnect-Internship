# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React + TypeScript in strict mode (user's choice). Static build, no backend.

## Users

- **Real audience:** DevConnect internship reviewers checking the "state and data" task (brief B: currency converter with live rates). They check that loading, error and empty states are visually and textually distinct, reachable without code changes, documented in the README; that the error says what failed and what to do; and that an unsupported currency pair reads as a gap in the data, not as an error.
- **The user the page serves** (inferred from the brief): anyone who wants to know what an amount is worth in another currency, such as a traveller, an online shopper or a freelancer pricing an invoice. They want one clear number, fast, and to know how fresh it is.

## Product Purpose

Convert an amount between two currencies using live reference rates from a public API, and handle the three non-happy states honestly:

- **Loading:** rates are on their way.
- **Error:** the request failed. Say what failed and what to do.
- **Empty:** the request worked, but the source has no rate for the chosen pair. Say that plainly, as missing data, not as a fault.

Success means a person gets their number in seconds, and a reviewer can see all three states on purpose.

## Positioning

A converter that is honest about its data: it shows where the rate comes from and which day it is for, and it says "no rate for this pair" instead of guessing, hiding the currency or blaming the network.

## Operating Context

- Rates come from Frankfurter (https://api.frankfurter.dev), which republishes the European Central Bank's reference rates. These are updated once per working day around 16:00 CET and cover about 30 currencies. No API key is needed.
- One request fetches all rates against the euro; any pair is a cross rate through the euro.
- The currency menus offer more currencies than the source covers (a curated list of commonly used world currencies), so uncovered pairs are a normal, reachable situation.
- Reviewers force the other states with documented URL switches: `?simulate=slow` holds the loading state, `?simulate=error` points the request at a broken endpoint so the real error path runs. On-page links lead to each, and the README documents them.

## Capabilities and Constraints

- Amount input, "from" and "to" currency, swap, the converted result, the rate used and its date, and a way to refresh the rates.
- A rate history chart for the chosen pair (1 month, 3 months or 1 year of daily ECB rates), with the change, high and low, keyboard reading and a table view. Added at the user's request so the page is more useful than a single number. It has its own loading, error and no-data states.
- ECB reference rates are for information only, not for trading or payments. The page must say so.
- Front end only. No accounts, no storage of what people convert.

## Brand Commitments

None yet. No name or logo has been given; the product needs a plain working name.

## Evidence on Hand

- Live data from the Frankfurter API (ECB). No invented rates, user counts, testimonials or claims about accuracy beyond what the ECB publishes.

## Product Principles

1. The three states are different situations and must look and read differently.
2. Errors explain themselves: what failed, why if known, and the next step.
3. Missing data is information, not failure.
4. Show the source and the date of every rate.

## Accessibility & Inclusion

WCAG 2.2 AA. State changes are announced to screen readers (loading, result, error, empty). Everything works by keyboard. Respect reduced motion. Works at 320px wide and in light and dark mode.
