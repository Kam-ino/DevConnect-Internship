# Accessible Layout: Conference Schedule

A one-page website for Wrenfield Frontend Day, a fictional free one-day conference about building accessible websites. It was built for the DevConnect frontend track (theme: **Conference Schedule**) to practise accessible layout: semantic structure, an accessible data table, keyboard access, readable colour in light and dark mode, and a form that explains its errors.

The page is designed as the conference's **printed programme**. A live stamp counts down to the day, then says what's on now, then says "That's a wrap". Session times are stamped in violet ink, and sessions that are over fade to dry ink. A successful registration gets a REGISTERED stamp on the attendee badge.

**Stack:** React 19 and Vite 8, plain JavaScript. Fonts are self-hosted through Fontsource. No backend.

## Running it

You need Node.js 20.19+ or 22.12+ (developed on Node 24).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests for the countdown and "on now" logic
npm run build      # production build in dist/
```

### Previewing the conference day

The live stamp and the "On now" markers depend on the time. To see the page as it looks during the event, add `?now=` to the URL:

- `/?now=2026-10-15T10:40` during the morning talks
- `/?now=2026-10-15T12:45` at lunch
- `/?now=2026-10-15T17:00` after the event

The programme card then says it's a preview and links back to the real time.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell, title, theme colours |
| `src/main.jsx` | Loads fonts and styles, mounts the app |
| `src/App.jsx` | Page layout and content: header, schedule section, venue, questions, footer |
| `src/ProgrammeSlip.jsx` | The day at a glance, with the live countdown or "On now" stamp |
| `src/Schedule.jsx` | The full schedule table (times by room) |
| `src/RegisterForm.jsx` | Registration form with validation and the error summary |
| `src/schedule.js` | The programme data and the countdown and "on now" logic |
| `src/schedule.test.js` | Tests for `schedule.js` (`node --test`, no test framework) |
| `src/styles.css` | Colour tokens, layout, light and dark themes |
| `src/assets/reading-room.jpg` | The venue photo, bundled by Vite (its origin is embedded in the file) |
| `PRODUCT.md` | Who the page is for and what it must do |
| `DESIGN.md` | The design system: colours, type, components |

## What makes it accessible

### Structure

- **Landmarks:** `header`, `nav` (labelled "Main"), `main` and `footer`.
- **Headings:** one `h1`, an `h2` for each section, `h3` inside sections. Where a side column sits visually before its section's main content, it comes after it in the HTML, so the heading order stays correct for screen readers.
- **Skip link:** the first thing you reach with Tab.
- **The schedule is a real data table.** Times are row headers and rooms are column headers, so a screen reader announces, for example, "10:15 am, Hall B, Forms that explain their errors". Sessions everyone attends span both rooms. On phones the table is restyled as stacked time blocks with a room label on each talk. The markup keeps explicit table roles, so screen readers still get rows and headers at that width. The table is named by the visible "Schedule" heading.
- **Live status:** the countdown, "On now" and "That's a wrap" are worked out from the visitor's clock. During the day, the talks running right now and their halls are listed under the stamp. The current session is marked with `aria-current="time"` and a visible "On now" label, not by colour alone.
- **Times** use `<time datetime>`.
- **Questions** use native `<details>` and `<summary>`, so they work with the keyboard and screen readers without extra JavaScript.

### Visual

- **Contrast:** every text and background pair passes WCAG AA in both light and dark mode.
- **Dark mode** follows the system setting. The goldenrod page becomes a dark violet "ink pad" and the ink turns goldenrod.
- **Focus:** a 3px outline on everything you can reach with the keyboard.
- **Target size:** buttons and form controls are at least 44px tall, and nothing is under 24px (WCAG 2.5.8).
- **Fonts:** body text is [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/), designed by the Braille Institute for low-vision readers, at an 18px base set in `rem`. Stamps and headings use Barlow Condensed, and typed details use Atkinson Hyperlegible Mono.
- **Stamp texture** comes from an SVG filter over real text, so stamped words can still be selected, zoomed and read by screen readers. Small stamps get a gentler filter so they stay legible.
- **Reflow:** works at 320px wide with no horizontal scrolling.
- **Motion:** stamps press onto the paper once. Smooth scrolling and that animation are switched off when the user asks for reduced motion.
- **High contrast mode:** buttons and paper keep a border, and the drawn radio buttons and checkbox fall back to native controls, so everything stays visible when Windows replaces the page colours.

### Form

- Every input has a visible `<label>`. No placeholder is used as a label, and the optional field says "(optional)".
- Hints and errors are connected to inputs with `aria-describedby`. The attendance options are grouped in a `<fieldset>` with a `<legend>`.
- `autocomplete="name"` and `autocomplete="email"` let browsers fill in details (WCAG 1.3.5).
- When you submit with mistakes:
  - an error summary appears and receives focus
  - each message links to the field that needs fixing, and the link moves focus into it
  - the fields get `aria-invalid="true"`
  - the page title starts with "Error:"
- After a valid registration the form becomes the attendee's badge (name, how they're attending, the REGISTERED stamp). Focus moves to the badge heading so keyboard and screen reader users aren't left on a control that no longer exists. "Register someone else" brings the form back and puts focus in the first field.
- The success message is in a `role="status"` region that is always on the page, so it is announced when it fills in. The REGISTERED stamp is decorative and hidden from screen readers so the message isn't read twice.

## How it was tested

- **[axe-core](https://github.com/dequelabs/axe-core) 4.10** with the WCAG 2.2 AA and best-practice rules: no violations in light or dark mode, with the page clean, with form errors shown and every question open, after a successful registration, and in both the countdown and "On now" states.
- **Accessibility tree:** checked at phone width to confirm the schedule still exposes rows, row headers, column headers and cells.
- **Widths:** 1440px, 390px and 320px. No horizontal scrolling, and the navigation fits on one line on a phone.
- **Form flow:** empty submit, invalid email, error-summary links, then a valid submit.
- **Logic:** `npm test` covers the countdown, the day before, before doors open, during a talk, lunch, after closing, later days, and which sessions are over.

It has **not** been tested with a real screen reader yet. Running through it with NVDA (Windows) or VoiceOver (macOS/iOS) is the next step.

## Limits

- The form is front end only. Nothing is sent anywhere.
- Times are treated as the visitor's local time, and the status is worked out when the page loads (it doesn't tick over while the page stays open).
- The conference, speakers and venue are fictional.

## Deploying

It builds to static files, so host it as a static site, not a server. On Render: **New → Static Site**, Root Directory `AccessibleLayout`, Build Command `npm install && npm run build`, Publish Directory `dist`.

## Credits

Venue photo (a reading room) by [Adam Przewoski](https://unsplash.com/photos/umchkHwkdyM) on Unsplash (Unsplash License), downloaded through [Lorem Picsum](https://picsum.photos) and bundled with the site.

The visual direction was chosen through the Impeccable design skill's direction round. The design record lives in `DESIGN.md`, and the build notes are in `.impeccable/`.
