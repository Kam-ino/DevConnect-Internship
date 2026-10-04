---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["index.html"]
---

## Scope

The Specimen currency converter, a single-screen React app in this folder. Visitor mode: Operate.

## Audience and job

Someone who wants to know what an amount is worth in another currency, and how the rate has been moving. Task: type an amount, choose From and To, read one number with its rate, source and date, then the pair's recent history. Real audience: internship reviewers checking that loading, error and empty are distinct, reachable without code changes and documented; that the error says what failed and what to do; and that an uncovered pair reads as a gap in the data.

## Constraints

WCAG 2.2 AA. Live ECB reference rates via Frankfurter, information only. Standard web controls. States reachable by URL switches documented in the README. User directive: take the US $100 note's layout, typography, arrangement and colours, with no portrait. That also means no signatures, official seals, legal-tender wording or serial-number format of the real note.

## Direction contract

THESIS: The result is printed like a US $100 note without its portrait. Corner denominations hold the two currency codes, the value runs in words across the top, the amount is struck in colour-shift copper, the rate and date are printed as green serials, and a blue security ribbon and a toothed seal sit where the note keeps them. The pair's history is engraved below as line work. It refuses the fintech default of a white card with flag circles and a blue button.

OWN-WORLD: Mint banknote paper, black engraving, serial green, colour-shift copper and a blue security ribbon, on a greenback band; serial red is reserved for errors. Bodoni Moda for engraved capitals, corner denominations and the amount; Geist for the interface; Geist Mono for codes, rates and dates. A hatched lathe-work border between two engraved rules frames the note. At night the note goes under UV light: a green-black ground, with the inks printed in flat fluorescent green, copper and blue and no glow.

STORY: The visitor types an amount, picks two currencies and reads one printed note: the value in words, the copper amount, the green rate and date. Then they see how the pair has moved. If the source has no rate, the note shows an empty watermark oval that says so plainly. If the request fails, a red void note says what failed and what to do, with a retry.

FIRST VIEWPORT: A greenback header band with "Specimen" on the left and the rate source and serial date on the right. A title row: the h1 on the left, the reviewer's "Check the states" links inline on the right. Two columns of equal height: the form on the left (amount, From, a swap button, To; standard input and selects), and the $100-style note on the right. Under both, a full-width rate history panel (period switch, engraved line chart, summary, table). At 1280 by 720 the form, the whole note and the start of the chart sit above the fold.

FORM: Banknote security printing, position 1 on my grounded list (IMPECCABLE'S PICK), chosen by the user, seed key a2a18156, then pinned by the user to the US $100 note's system. Signature move: engraving. The rate history is a copper line with hatching between it and the period's opening rate, read with a crosshair or the arrow keys. While rates load, a guilloche rosette generated from the pair engraves itself. A pair with no rate shows a blank watermark oval, and an error shows a red void overprint. It draws instantly under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Memorable moment

The value printed in engraved words across the top of the note, as a banknote prints its denomination.

## Unresolved

None.
