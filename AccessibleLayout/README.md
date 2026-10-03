# Accessible Layout

A one-page website for Wrenfield Library, a fictional neighbourhood library. It was built for the DevConnect frontend track to practise accessible layout: semantic structure, keyboard access, readable colour in light and dark mode, and a form that explains its errors.

The page is designed as a library **date-due slip**. Opening hours are stamped in violet ink on a ruled slip, a live stamp says whether the library is open right now, events are stamped dates, the common questions are printed on a book pocket, and a successful card application gets an ISSUED stamp.

**Stack:** React 19 and Vite 8, plain JavaScript. Fonts are self-hosted through Fontsource. No backend.

## Running it

You need Node.js 20.19+ or 22.12+ (developed on Node 24).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests for the open/closed logic
npm run build      # production build in dist/
```

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell, title, theme colours |
| `src/main.jsx` | Loads fonts and styles, mounts the app |
| `src/App.jsx` | Page layout and content: header, find us, events, questions, footer |
| `src/DueSlip.jsx` | The opening-hours slip with the live open/closed stamp |
| `src/CardForm.jsx` | Library card form with validation and the error summary |
| `src/hours.js` | Opening hours data and the "open now?" logic |
| `src/hours.test.js` | Tests for `hours.js` (`node --test`, no test framework) |
| `src/styles.css` | Colour tokens, layout, light and dark themes |
| `PRODUCT.md` | Who the page is for and what it must do |

## What makes it accessible

### Structure

- **Landmarks:** `header`, `nav` (labelled "Main"), `main` and `footer`.
- **Headings:** one `h1`, an `h2` for each section, `h3` inside sections. Where a side column sits visually before its section's main content, it comes after it in the HTML, so the heading order stays correct for screen readers.
- **Skip link:** the first thing you reach with Tab.
- **Opening hours** are a real `<table>` with a caption and `scope` on the header cells. Today's row is marked with `aria-current="date"` and a visible "Today" label.
- **Live status:** "Open now, until 5 pm" or "Closed now, opens tomorrow at 9 am" is worked out from the visitor's clock, including the one-off closure on 31 October.
- **Events** are an ordered list with `<time datetime>`. An event that has already happened says so in words, not just with faded ink.
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
- **High contrast mode:** buttons and paper keep a border, so they stay visible when Windows replaces the page colours.

### Form

- Every input has a visible `<label>`. No placeholder is used as a label.
- Hints and errors are connected to inputs with `aria-describedby`. The radio buttons are grouped in a `<fieldset>` with a `<legend>`.
- `autocomplete="name"` and `autocomplete="email"` let browsers fill in details (WCAG 1.3.5).
- When you submit with mistakes:
  - an error summary appears and receives focus
  - each message links to the field that needs fixing, and the link moves focus into it
  - the fields get `aria-invalid="true"`
  - the page title starts with "Error:"
- The success message is in a `role="status"` region, so it is announced without moving focus. The ISSUED stamp is decorative and hidden from screen readers so the message isn't read twice.

## How it was tested

- **[axe-core](https://github.com/dequelabs/axe-core) 4.10** with the WCAG 2.2 AA and best-practice rules: no violations in light or dark mode, with the page clean, with form errors shown and every question open, and after a successful application.
- **Widths:** 1440px, 390px and 320px. No horizontal scrolling, and the navigation fits on one line on a phone.
- **Form flow:** empty submit, invalid email, error-summary links, then a valid submit.
- **Logic:** `npm test` covers open, before opening, closed Mondays, skipping Monday after Sunday closing, the closure day, and the evening before it.

It has **not** been tested with a real screen reader yet. Running through it with NVDA (Windows) or VoiceOver (macOS/iOS) is the next step.

## Limits

- The form is front end only. Nothing is sent anywhere.
- The open/closed stamp uses the visitor's own clock and time zone, and it is worked out when the page loads (it doesn't tick over while the page stays open).
- The photo loads from picsum.photos. A production site should host it itself.

## Credits

Reading room photo by [Adam Przewoski](https://unsplash.com/photos/umchkHwkdyM) on Unsplash, served through [Lorem Picsum](https://picsum.photos).

The visual direction was chosen through the Impeccable design skill's direction round. The design record lives in `DESIGN.md`, and the build notes are in `.impeccable/`.
