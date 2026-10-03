---
name: Wrenfield Frontend Day
description: A one-day conference page printed as a programme on goldenrod card stock and stamped in violet ink.
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
  printed-head:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.2em"
  stamp-status:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(3rem, 2rem + 3.4vw, 5.25rem)"
    fontWeight: 700
    lineHeight: 0.92
  stamp-detail:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(1.375rem, 1.1rem + 0.8vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1
  stamp-row:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1
  stamp-row-fresh:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
  stamp-registered:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1
  badge-name:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.25rem, 1.75rem + 2vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1
  brand:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
  button:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  label-table:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  title:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  lede:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "tnum"
  body-small:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  nav:
    fontFamily: "Atkinson Hyperlegible Next Variable, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  typed:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  typed-list:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  typed-badge:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  typed-input:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.6
  typed-tag:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 700
rounded:
  card: "4px"
  none: "0"
  round: "50%"
  pill: "999px"
spacing:
  gutter: "1rem"
  gutter-wide: "2rem"
  slip-pad: "clamp(1.25rem, 3vw, 2.25rem)"
  section: "clamp(2.5rem, 5vw, 4.5rem)"
  axis-gap: "clamp(1.5rem, 3vw, 3rem)"
  stack-gap: "2.5rem"
  badge-top: "3.25rem"
components:
  button-primary:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.on-stamp}"
    typography: "{typography.button}"
    rounded: "{rounded.card}"
    padding: "0.5rem 1.75rem"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.stamp-hover}"
    textColor: "{colors.on-stamp}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.stamp}"
    typography: "{typography.button}"
    rounded: "{rounded.card}"
    padding: "0.5rem 1.75rem"
    height: "3.25rem"
  button-quiet-hover:
    backgroundColor: "color-mix(in srgb, #4c2c92 12%, transparent)"
    textColor: "{colors.stamp}"
  slip:
    backgroundColor: "{colors.slip}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.slip-pad}"
  badge-card:
    backgroundColor: "{colors.slip}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.badge-top}"
  lanyard-slot:
    backgroundColor: "{colors.field}"
    rounded: "{rounded.pill}"
    width: "4rem"
    height: "0.75rem"
  input-ruled:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.typed-input}"
    rounded: "{rounded.none}"
    padding: "0.375rem 0.25rem"
    height: "2.75rem"
  textarea-ruled:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.typed-input}"
    rounded: "{rounded.none}"
    padding: "0.375rem 0.25rem"
    height: "calc(1.6em * 3 + 0.75rem)"
  status-stamp:
    textColor: "{colors.stamp}"
    typography: "{typography.stamp-status}"
    rounded: "{rounded.card}"
    padding: "0.6rem 1rem 0.75rem"
  row-stamp:
    textColor: "{colors.stamp}"
    typography: "{typography.stamp-row}"
  row-stamp-fresh:
    textColor: "{colors.stamp}"
    typography: "{typography.stamp-row-fresh}"
  row-stamp-dry:
    textColor: "{colors.stamp-dry}"
  registered-stamp:
    textColor: "{colors.stamp}"
    typography: "{typography.stamp-registered}"
    rounded: "{rounded.card}"
    padding: "0.5rem 1rem"
  skip-link:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.on-stamp}"
    rounded: "{rounded.card}"
    padding: "0.75rem 1rem"
---

# Design System: Wrenfield Frontend Day

## Overview

**Creative North Star: "The Stamped Programme"**

The page is conference stationery. A goldenrod card-stock field carries slip-white paper cards; the paper is printed in red (titles, column heads, field names, rules) and then stamped in violet ink (every time, the live status, the registration mark and every action). Reading text is set in a high-legibility sans and stays out of the stamp vocabulary, so the stationery never costs comprehension.

The world has three materials and each has one job: the field is the desk, the slip is paper, ink is what the organisers did to the paper. Stamps are real, selectable text roughened by an SVG displacement filter and tilted a few degrees, never images. Freshness of ink encodes time: the slot running now is darker and larger with a typed "On now" tag, slots that are over are dry ink.

At night the materials swap rather than dim. The field becomes the violet ink pad, the slips go deep violet, and the ink turns goldenrod. Density is calm: one slip per idea, generous section padding, a 65ch reading measure.

**Key Characteristics:**
- Goldenrod field, slip-white paper, violet ink, red print.
- Stamped type is condensed, uppercase, tilted and filter-roughened live text.
- Ink freshness (fresh, standard, dry) marks now versus past.
- A 12-column page axis: copy on columns 1 to 5, slips from column 6.
- One soft paper shadow; the only other depth is the lanyard slot punched into the badge card.
- Dark scheme inverts field and ink instead of dimming.

## Colors

A warm card-stock field with two inks: violet for what was stamped, red for what was printed.

### Primary
- **Stamp-Pad Violet** (stamp): every stamp, both button variants, links inside slips, the "On now" tag, focus rings, checked marks, the drawn accordion plus, the status box border, selection, caret, accent-color and scrollbar thumb. At night it becomes **Goldenrod Ink** (stamp-night).
- **Fresh Ink** (stamp-hover): the primary button hover. Night: stamp-hover-night.
- **Dry Ink** (stamp-dry): time stamps for slots that are over, in both the glance table and the schedule. Night: stamp-dry-night.

### Secondary
- **Printer's Red** (print): slip titles, the double-ruled printed heads, table column heads, phone room tags, form field names, input underlines, the questions foot rule and the slip note. Night: print-night.
- **Ruling Pink** (rule): the thin 1px row rules in both tables and between questions, the ruled lines of the textarea, and the lanyard slot's hairline edge. Night: rule-night.

### Neutral
- **Goldenrod Card Stock** (field): the page background behind everything, and the fill of the lanyard slot so the slot reads as a hole through the card. Night: field-night, the violet ink pad.
- **Slip White** (slip): paper cards and the photo plate's mat. Night: slip-night.
- **Pressed Black-Violet** (ink, field-ink): body text on slip and field, tick-box borders, the footer rule. Night: ink-night.
- **Faded Ink** (muted): hints, speakers and rooms, quiet sessions (breaks, lunch, registration), the badge date, the preview note, and the lanyard slot edge at night. Night: muted-night.
- **Warning Red** (error): invalid underlines, the error summary border and error text. Night: error-night.

### Named Rules
**The Two Inks Rule.** Violet is what was stamped or what you can press; red is what came printed on the stationery. Never set an action in red or a printed label in violet.

**The Night Swap Rule.** The dark scheme is the same world turned over: field becomes the violet pad and ink becomes goldenrod. Use the night tokens; never derive dark values by dimming the light ones.

**The Fresh Ink Rule.** Freshness carries time. The current slot gets the fresh stamp size and bold label, past slots get dry ink, everything else gets the standard stamp.

## Typography

**Display Font:** Barlow Condensed 600/700 (with Arial Narrow)
**Body Font:** Atkinson Hyperlegible Next Variable (with system-ui)
**Label/Mono Font:** Atkinson Hyperlegible Mono Variable (with ui-monospace)

**Character:** A condensed rubber-stamp face for anything printed or stamped, a legibility-first sans for anything read, and a typewriter mono for anything typed onto the card (speakers, rooms, the on-now list, badge details, answers). All numerals are tabular.

### Hierarchy
- **Display** (700, fluid 2.75rem to 5rem, 0.95): the single H1 on the field.
- **Headline** (700, fluid 2rem to 3.25rem, 0.95): section H2s on the field.
- **Printed** (700, fluid 1.75rem to 2.5rem, uppercase, 0.04em, Printer's Red): the title printed at the top of each slip.
- **Printed Head** (700, 1.375rem, 0.2em, uppercase, centred between 3px double red rules): the day's date on the programme slip and the event name on the badge.
- **Stamp Status** (700, fluid 3rem to 5.25rem, 0.92): the live countdown or ON NOW headline; the largest type on the page. Its detail line is 600 at fluid 1.375rem to 1.875rem.
- **Stamp Row** (600, 1.375rem; fresh 700, 1.75rem): stamped times in both tables, through the fine filter.
- **Badge Name** (700, fluid 2.25rem to 3.5rem, uppercase, breaks anywhere): the attendee's name on the badge.
- **Registered Stamp** (700, 2rem; date line 1.125rem at 0.06em).
- **Title** (Atkinson 700, 1.25rem, 1.25): H3s; session titles use body size at 700.
- **Body** (400, 1.125rem, 1.6, max 65ch; lede 1.25rem at 30ch): all reading text. Small body (1rem) for hints, the questions foot and the footer.
- **Nav** (400, 1rem, 1.0625rem from 40rem).
- **Label** (Barlow 700, 1.125rem, 0.06em, uppercase, Printer's Red): form field names and legends. Table heads use 1rem; phone room tags 0.9375rem. Buttons use 1.375rem at 0.04em; the brand 1.75rem at 0.02em.
- **Typed** (Mono 400, 1.5): speakers and rooms at 0.9375rem, the on-now list and badge date at 1rem, the badge attendance at 1.0625rem, input values at 1.1875rem, the "On now" tag at 0.875rem 700.

### Named Rules
**The Three Hands Rule.** Barlow is the printer and the stamp, Atkinson Next is the reader, Mono is the typist. Sentences are never set in Barlow, and stamps are never set in Atkinson.

**The Real Text Rule.** Stamps are live text with an SVG ink filter; the speckled filter is for display-size stamps (status, REGISTERED), row-size stamps get the edge-only fine filter so speckle never costs legibility.

## Layout

A centred wrap of `min(100% - 2 × gutter, 78rem)`; the gutter is 1rem on phones and 2rem from 48rem. From 60rem every section is a 12-column grid (column gap clamp 1.5rem to 3rem): copy takes columns 1 to 5, the slip takes 6 to the end. The full schedule is the one slip that spans all 12 columns, because a two-room timetable needs the width. In the register section the badge card keeps the slip side and the "what happens next" copy sits on the left in the same row.

Below 60rem sections stack with a 2.5rem gap. Below 48rem the schedule table becomes blocks: the column heads are visually hidden, each time is a block with its talks stacked beneath and a red room tag above each talk, and the markup keeps explicit table roles so assistive tech still gets rows and headers. From 40rem the REGISTERED stamp lands on the badge itself; below that it sits under the badge text. Sections are padded clamp 2.5rem to 4.5rem vertically; slips are padded clamp 1.25rem to 2.25rem. Breakpoints are 40rem, 48rem and 60rem. The layout reflows to 320px without horizontal scroll.

**The Slip Side Rule.** On wide screens paper lives from column 6 to the end and the field's copy lives in columns 1 to 5; only content that genuinely needs the full measure (the timetable) spans both.

## Elevation & Depth

Nearly flat. The field carries a fixed fractal-noise card-stock tooth (22% multiply in light, 10% screen at night). The only lift is paper resting on the field: slips and the photo plate share one soft two-layer shadow tinted with the field's brown (black at night). The only other depth is inward: the lanyard slot is a hole punched through the badge card, so it gets an inset shadow and a hairline edge. Nothing else casts a shadow; the button press is a 1px translate.

### Shadow Vocabulary
- **Paper on Card** (`box-shadow: 0 1px 2px rgb(92 58 0 / 0.2), 0 18px 40px -18px rgb(92 58 0 / 0.45)`; night `0 1px 2px rgb(0 0 0 / 0.4), 0 18px 40px -18px rgb(0 0 0 / 0.7)`): slips and the photo plate only.
- **Punched Slot** (`box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.3), 0 0 0 1px var(--rule)`; night `inset 0 1px 2px rgb(0 0 0 / 0.6), 0 0 0 1.5px var(--muted)`): the lanyard slot only. The night edge is stronger so a dark hole stays visible on a dark card.

### Named Rules
**The Paper Only Rule.** Shadow belongs to paper objects lying on the field, and inset shadow to holes cut through paper. Controls, stamps and text never lift.

## Shapes

Barely rounded stationery corners (4px) on every slip, button, stamp frame, plate, status box, error box and checkbox. Text inputs and the textarea are square with only a bottom rule, like a ruled line on a printed form. Radios are full circles; the lanyard slot is a full pill (999px, 4rem by 0.75rem) centred 1.25rem from the badge card's top edge. Printed heads use 3px double rules above and below; the questions foot has a 3px double rule above; the status and REGISTERED stamps have 0.4rem and 0.35rem double borders in their own ink. Stamps rotate between -8deg and about +1.1deg; each glance row has its own small tilt, the status stamp -3deg, REGISTERED -8deg.

## Components

### Buttons
Stamped labels, solid and confident.
- **Shape:** stationery corners (4px), 3.25rem minimum height, label centred, no wrap.
- **Primary:** Stamp-Pad Violet fill and 2px border, on-stamp text, Barlow 700 1.375rem uppercase at 0.04em, padding 0.5rem 1.75rem.
- **Hover / Focus:** hover deepens to Fresh Ink; active presses down 1px; focus is the global 3px violet outline offset 3px. Transitions 0.15s only when motion is allowed.
- **Quiet:** same stamp border and type, transparent fill, violet text; hover washes 12% violet. Used for secondary actions such as registering someone else, sized to its label rather than the card.

### Cards / Containers (the slip)
- **Corner Style:** 4px.
- **Background:** Slip White with Pressed Black-Violet text; links inside are violet.
- **Shadow Strategy:** Paper on Card.
- **Border:** 1px transparent (shows as an outline in forced-colors mode).
- **Internal Padding:** clamp 1.25rem to 2.25rem.
- **Variants:** the programme slip (printed title, status stamp, on-now list, printed date head, day-at-a-glance table, red slip note), the schedule card, the questions card (accordion and double-ruled foot), and the badge card.

### Inputs / Fields
- **Style:** transparent, square, 2px Printer's Red underline, Mono 1.1875rem, 2.75rem tall. Field names above in the red Label style; "(optional)" in Faded Ink 600; hints in Faded Ink at 1rem.
- **Ruled textarea:** three ruled lines tall (`calc(1.6em * 3 + 0.75rem)`), Ruling Pink lines drawn every 1.6em that scroll with the text, vertical resize only.
- **Focus:** the global violet outline.
- **Error:** underline thickens to 4px Warning Red with an 8% error wash; inline bold error text below; a 3px Warning Red error summary box receives focus on failed submit.
- **Choices:** drawn tick boxes 1.5rem with a 2px ink border (circle for radio, 4px for checkbox); the checked mark is a violet dot or a clipped violet tick. Native controls return under forced colors.
- **Status message:** a 2px violet bordered box, bold, announced politely; hidden while empty.

### Navigation
Plain text links in body ink at 1rem (1.0625rem from 40rem), wrapping, 0.6rem block padding for touch. Underline is transparent at rest and appears on hover; the brand is Barlow 700 1.75rem uppercase.

### Tables
- **Day at a glance:** two columns, label left and stamped time right; 2px red head rule with red Barlow heads, 1px Ruling Pink row rules. The current row's label goes bold with a typed "On now" tag.
- **Schedule:** times as row headers (stamped, 10rem column), rooms as column heads; session title bold, speaker and room typed in Faded Ink; quiet sessions (breaks, lunch, registration) drop to Faded Ink 400. Below 48rem it becomes the stacked phone layout described in Layout.

### Stamps (signature)
Violet, Barlow uppercase, live text through the ink filter, tilted.
- **Status stamp:** double-bordered frame at -3deg holding the countdown, TOMORROW, TODAY, ON NOW or THAT'S A WRAP headline at Stamp Status size and a detail line. During the day a typed list of the sessions running now sits directly under it.
- **Row stamp:** right-aligned in the glance table with a per-row tilt, left in the schedule; fresh, standard or dry per the Fresh Ink Rule.
- **REGISTERED stamp:** double frame at -8deg with the registration date beneath; from 40rem it overlaps the badge bottom-right, blended (multiply, screen at night) so text under it stays readable.
- **Press motion:** 480ms `cubic-bezier(0.16, 1, 0.3, 1)` from 1.2x scale and 10% opacity; applied to the status stamp on load and REGISTERED on submit, skipped under reduced motion.

### Attendee Badge (signature)
The registration slip is a badge card: 3.25rem top padding under a field-coloured lanyard slot. After registering, the form is replaced by the badge: a printed head with the event name, the attendee's name in Badge Name type, attendance and date typed beneath, the REGISTERED stamp, and a quiet button to start again. Focus moves to the card title on the swap.

### Accordion (questions)
Native details/summary rows split by Ruling Pink rules; bold summary with a drawn 3px violet plus that loses its upright when open (0.2s, motion-gated).

### Photo Plate
A single 4:3 photograph tipped onto the field in a 0.5rem Slip White mat with the paper shadow.

## Do's and Don'ts

### Do:
- **Do** stamp every time, status and registration mark in violet Barlow uppercase as live text through the ink filter.
- **Do** print slip titles, field names, table heads and rules in Printer's Red.
- **Do** keep paper on the column 6 side of the axis on wide screens; span all 12 columns only for content that needs the width.
- **Do** use ink freshness (fresh, standard, dry) to show where now falls in the day.
- **Do** use the night tokens for dark mode so the field becomes the ink pad and ink turns goldenrod.
- **Do** gate every motion (press, transitions, smooth scroll) behind prefers-reduced-motion and show the final state instantly otherwise.
- **Do** keep every text and background pair at WCAG AA in both schemes.

### Don't:
- **Don't** set reading sentences in Barlow Condensed or stamps in Atkinson.
- **Don't** use the speckled ink filter on stamps at row size or smaller; use the fine filter.
- **Don't** set actions in red or printed labels in violet.
- **Don't** add shadows to anything that is not paper on the field or a hole punched through it.
- **Don't** add small uppercase labels above headings; printed heads between double rules are reserved for the day's date and the badge's event name.
- **Don't** replace live stamped text with images of stamps.
