---
name: Wrenfield Library
description: A neighbourhood library page printed as a date-due slip and stamped in ink.
colors:
  field: "#f2b705"
  field-ink: "#1d1a24"
  slip: "#f7f8fa"
  ink: "#1d1a24"
  muted: "#4d4760"
  stamp: "#4c2c92"
  stamp-hover: "#3a1f75"
  stamp-dry: "#7562a8"
  on-stamp: "#f7f8fa"
  print: "#c8102e"
  rule: "#ecb4bd"
  error: "#b0102b"
  field-night: "#17112a"
  field-ink-night: "#f1edf9"
  slip-night: "#221a3a"
  ink-night: "#f1edf9"
  muted-night: "#c0b8d6"
  stamp-night: "#f2b705"
  stamp-hover-night: "#ffcb3d"
  stamp-dry-night: "#b8962e"
  on-stamp-night: "#17112a"
  print-night: "#ff7a90"
  rule-night: "#4a3462"
  error-night: "#ff9aa8"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.75rem, 1.5rem + 3.6vw, 5rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2rem, 1.5rem + 2vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 0.95
  printed:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(1.75rem, 1.4rem + 1.2vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0.04em"
  stamp-status:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(3rem, 2rem + 3.4vw, 5.25rem)"
    fontWeight: 700
    lineHeight: 0.92
  stamp-row:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1
  title:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "tnum"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  typed:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  card: "4px"
  none: "0"
  round: "50%"
spacing:
  gutter: "1rem"
  gutter-wide: "2rem"
  slip-pad: "clamp(1.25rem, 3vw, 2.25rem)"
  section: "clamp(2.5rem, 5vw, 4.5rem)"
  axis-gap: "clamp(1.5rem, 3vw, 3rem)"
components:
  button-primary:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.on-stamp}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "0.5rem 1.75rem"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.stamp-hover}"
    textColor: "{colors.on-stamp}"
  slip:
    backgroundColor: "{colors.slip}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.slip-pad}"
  input-ruled:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.typed}"
    rounded: "{rounded.none}"
    padding: "0.375rem 0.25rem"
    height: "2.75rem"
  status-stamp:
    textColor: "{colors.stamp}"
    typography: "{typography.stamp-status}"
    rounded: "{rounded.card}"
    padding: "0.6rem 1rem 0.75rem"
  status-stamp-closed:
    textColor: "{colors.print}"
  event-stamp:
    textColor: "{colors.stamp}"
    rounded: "{rounded.card}"
    padding: "0.3rem 0.45rem"
  event-stamp-past:
    textColor: "{colors.stamp-dry}"
  skip-link:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.on-stamp}"
    rounded: "{rounded.card}"
    padding: "0.75rem 1rem"
---

# Design System: Wrenfield Library

## Overview

**Creative North Star: "The Date-Due Slip"**

The page is library stationery. A goldenrod card-stock field carries slip-white paper cards; the paper is printed in red (headings, field names, rules) and then stamped in violet ink (every date, time, status and action). Reading text is set in a high-legibility sans and stays out of the stamp vocabulary, so the stationery never costs comprehension.

The world has three materials and each has one job: the field is the desk, the slip is paper, ink is what the library did to the paper. Stamps are real, selectable text roughened by an SVG displacement filter and tilted a few degrees, never images. Freshness of ink encodes time: today and the next event are darker and larger, past rows and events are dry ink.

At night the materials swap rather than dim. The field becomes the violet ink pad, the slips go deep violet, and the ink turns goldenrod. Density is calm: one wide column of facts per slip, generous section padding, a 65ch reading measure.

**Key Characteristics:**
- Goldenrod field, slip-white paper, violet ink, red print.
- Stamped type is condensed, uppercase, tilted and filter-roughened live text.
- Ink freshness (fresh, wet, dry) marks today versus past.
- A 12-column page axis whose column 6 is the date column.
- One soft paper shadow; everything else is flat.
- Dark scheme inverts field and ink instead of dimming.

## Colors

A warm card-stock field with two inks: violet for what was stamped, red for what was printed.

### Primary
- **Stamp-Pad Violet** (stamp): every stamp, the primary button, links inside slips, focus rings, checked marks, the drawn accordion plus, selection, caret, accent-color and scrollbar thumb. At night it becomes **Goldenrod Ink** (stamp-night).
- **Fresh Ink** (stamp-hover): the button hover and the pressed state of the ink; darker means fresher. Night: stamp-hover-night.
- **Dry Ink** (stamp-dry): hours rows before today and events that have passed. Night: stamp-dry-night.

### Secondary
- **Printer's Red** (print): slip titles, the DATE DUE head, table column heads, form field names, input underlines, double rules, the closure note and the closed status stamp. Night: print-night.
- **Ruling Pink** (rule): the thin 1px row rules between hours, events and questions. Night: rule-night.

### Neutral
- **Goldenrod Card Stock** (field): the page background behind everything; also the colour of the pocket's thumb notch. Night: field-night, the violet ink pad.
- **Slip White** (slip): paper cards and the photo plate's mat. Night: slip-night.
- **Pressed Black-Violet** (ink, field-ink): body text on slip and field. Night: ink-night.
- **Faded Ink** (muted): hints and the typed event tickets. Night: muted-night.
- **Warning Red** (error): invalid underlines, the error summary border and error text. Night: error-night.

### Named Rules
**The Two Inks Rule.** Violet is what the library stamped or what you can press; red is what came printed on the stationery. Never set an action in red or a printed label in violet.

**The Night Swap Rule.** The dark scheme is the same world turned over: field becomes the violet pad and ink becomes goldenrod. Use the night tokens; never derive dark values by dimming the light ones.

**The Fresh Ink Rule.** Freshness carries time. The current item gets fresh ink and the largest size, past items get dry ink, everything else gets the standard stamp.

## Typography

**Display Font:** Barlow Condensed 600/700 (with Arial Narrow)
**Body Font:** Atkinson Hyperlegible Next Variable (with system-ui)
**Label/Mono Font:** Atkinson Hyperlegible Mono Variable (with ui-monospace)

**Character:** A condensed rubber-stamp face for anything printed or stamped, a legibility-first sans for anything read, and a typewriter mono for typed tickets and answers. All numerals are tabular.

### Hierarchy
- **Display** (700, clamp 2.75rem to 5rem, 0.95): the single H1 on the field.
- **Headline** (700, clamp 2rem to 3.25rem, 0.95): section H2s on the field.
- **Printed** (700, clamp 1.75rem to 2.5rem, uppercase, 0.04em, Printer's Red): the title printed at the top of each slip.
- **Stamp Status** (700, clamp 3rem to 5.25rem, 0.92, uppercase): the live open/closed stamp; the largest type on the page.
- **Stamp Row** (600 at 1.375rem; fresh ink 700 at 1.75rem): stamped hours and event dates (event dates 1.5rem, the next event 1.75rem to 2rem).
- **Title** (Atkinson 700, 1.25rem, 1.25): event titles and H3s.
- **Body** (400, 1.125rem, 1.6, max 65ch; lede 1.25rem at 30ch): all reading text.
- **Label** (Barlow 700, 1.125rem, 0.06em, uppercase, Printer's Red): form field names and legends; table heads use the same face at 1rem. Buttons use it at 1.375rem, 0.04em.
- **Typed** (Mono 400, 0.9375rem, 1.5): event tickets (when and where), input values at 1.1875rem, the "Today" tag at 0.875rem 700.

### Named Rules
**The Three Hands Rule.** Barlow is the printer and the stamp, Atkinson Next is the reader, Mono is the typist. Sentences are never set in Barlow, and stamps are never set in Atkinson.

**The Real Text Rule.** Stamps are live text with an SVG ink filter; the heavy speckled filter is for display-size stamps only, small stamps (row size and below) get the edge-only fine filter so speckle never costs legibility.

## Layout

A centred wrap of `min(100% - 2 × gutter, 78rem)`; the gutter is 1rem on phones and 2rem from 48rem. From 60rem every section is a 12-column grid (column gap clamp 1.5rem to 3rem): copy takes columns 1 to 5, the slip takes 6 to the end. The events ledger joins that grid through subgrid so each date stamp sits in columns 6 to 7 and each ticket in 8 onward, putting every stamped date on one vertical axis down the page. In the card section the order flips visually so the form slip stays on the date side.

Below 60rem sections stack with a 2.5rem gap. Below 40rem event stamps move above their titles; from 40rem an event is a 7.5rem stamp column plus text. Sections are padded clamp 2.5rem to 4.5rem vertically; slips are padded clamp 1.25rem to 2.25rem. Breakpoints are 40rem, 48rem and 60rem. The layout reflows to 320px without horizontal scroll.

**The Date Column Rule.** On wide screens column 6 is the date column. Any new dated content aligns its stamp to it.

## Elevation & Depth

Nearly flat. The field carries a fixed fractal-noise card-stock tooth (22% multiply in light, 10% screen at night). The only lift is paper resting on the field: slips and the photo plate share one soft two-layer shadow tinted with the field's brown (black at night). Nothing else casts a shadow; the button press is a 1px translate, not a shadow.

### Shadow Vocabulary
- **Paper on Card** (`box-shadow: 0 1px 2px rgb(92 58 0 / 0.2), 0 18px 40px -18px rgb(92 58 0 / 0.45)`; night `0 1px 2px rgb(0 0 0 / 0.4), 0 18px 40px -18px rgb(0 0 0 / 0.7)`): slips and the photo plate only.

### Named Rules
**The Paper Only Rule.** Shadow belongs to paper objects lying on the field. Controls, stamps and text never lift.

## Shapes

Barely rounded stationery corners (4px) on every slip, button, stamp frame, plate, error box and checkbox. Text inputs are square with only a bottom rule, like a ruled line on a printed form. Radios and the pocket's thumb notch are full circles. Printed heads and stamp frames use double borders: 3px double rules around DATE DUE and above the pocket foot, 0.35 to 0.4rem double borders on the status and ISSUED stamps, a 3px single border on event date stamps. Stamps rotate between about -8deg and +1.4deg; every hours row has its own small tilt.

## Components

### Buttons
Stamped labels, solid and confident.
- **Shape:** stationery corners (4px), 3.25rem minimum height.
- **Primary:** Stamp-Pad Violet fill and 2px border, on-stamp text, Barlow 700 1.375rem uppercase at 0.04em, padding 0.5rem 1.75rem, no wrap.
- **Hover / Focus:** hover deepens to Fresh Ink; active presses down 1px; focus is the global 3px violet outline offset 3px. Transitions 0.15s only when motion is allowed.
- There is one button variant.

### Cards / Containers (the slip)
- **Corner Style:** 4px.
- **Background:** Slip White with Pressed Black-Violet text; links inside are violet.
- **Shadow Strategy:** Paper on Card.
- **Border:** 1px transparent (shows as an outline in forced-colors mode).
- **Internal Padding:** clamp 1.25rem to 2.25rem.
- **Variants:** the hours slip (printed title, status stamp, DATE DUE head, ruled table), the events ledger, the book pocket (a field-coloured semicircle notch cut from the top edge, centred printed title, double-ruled foot), and the borrower card (form).

### Inputs / Fields
- **Style:** transparent, square, 2px Printer's Red underline, Mono 1.1875rem, 2.75rem tall. Field names above in the red Label style; hints in Faded Ink at 1rem.
- **Focus:** the global violet outline.
- **Error:** underline thickens to 4px Warning Red with an 8% error wash; inline bold error text below; a 3px Warning Red error summary box receives focus on failed submit.
- **Choices:** drawn tick boxes 1.5rem with a 2px ink border (circle for radio, 4px for checkbox); the checked mark is a violet dot or a clipped violet tick. Native controls return under forced colors.

### Navigation
Plain text links in body ink at 1rem (1.0625rem from 40rem), wrapping, 0.6rem block padding for touch. Underline is transparent at rest and appears on hover; the brand is Barlow 700 1.75rem uppercase.

### Stamps (signature)
Violet, Barlow uppercase, live text through the ink filter, tilted.
- **Status stamp:** double-bordered frame at -3deg holding the date, the OPEN NOW / CLOSED NOW headline at Stamp Status size and the detail line; switches to Printer's Red when closed.
- **Hours row stamp:** right-aligned in the table, per-row tilt; today is fresh and largest with a mono "Today" tag, earlier days are dry.
- **Event date stamp:** 3px framed day-month at -4deg; the next event -6deg and larger, past events dry with a "This event has passed" note in the ticket.
- **ISSUED stamp:** double frame at -8deg, appears on the borrower card after a successful application; absolutely placed top-right from 60rem.
- **Press motion:** 480ms `cubic-bezier(0.16, 1, 0.3, 1)` from 1.2× scale and 10% opacity; applied to the status stamp on load and ISSUED on submit, and skipped entirely under reduced motion.

### Accordion (pocket questions)
Native details/summary rows split by Ruling Pink rules; bold summary with a drawn 3px violet plus that loses its upright when open (0.2s, motion-gated).

### Photo Plate
A single 4:3 photograph tipped onto the field in a 0.5rem Slip White mat with the paper shadow.

## Do's and Don'ts

### Do:
- **Do** stamp every date, time and status in violet Barlow uppercase as live text through the ink filter.
- **Do** print slip titles, field names, table heads and rules in Printer's Red.
- **Do** align new dated content to the column 6 date axis on wide screens.
- **Do** use ink freshness (fresh, standard, dry) to show where today falls.
- **Do** use the night tokens for dark mode so the field becomes the ink pad and ink turns goldenrod.
- **Do** gate every motion (press, transitions, smooth scroll) behind prefers-reduced-motion and show the final state instantly otherwise.
- **Do** keep every text and background pair at WCAG AA in both schemes.

### Don't:
- **Don't** set reading sentences in Barlow Condensed or stamps in Atkinson.
- **Don't** use the speckled ink filter on stamps at row size or smaller; use the fine filter.
- **Don't** set actions in red or printed labels in violet.
- **Don't** add shadows to anything that is not paper on the field.
- **Don't** add small uppercase labels above headings; the only printed head is DATE DUE between double rules on the hours slip.
- **Don't** replace live stamped text with images of stamps.
