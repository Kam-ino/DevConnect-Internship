---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["index.html"]
---

## Scope

The Wrenfield Frontend Day one-page site (React app in this folder), themed "Conference Schedule". Visitor mode: Persuade.

## Audience and job

Someone deciding whether to attend, or attending on the day, who needs to know when it is, what's on now, what's on in each room, whether the venue works for them, and how to register. Real audience: internship reviewers checking accessible layout. Action: register for a free place. Proof: a full dated two-room schedule and a live countdown or on-now status. No invented stats, sponsors or attendee numbers.

## Constraints

WCAG 2.2 AA, verified. Front-end only form. Fictional details stay obviously fictional.

## Direction contract

THESIS: The page is the conference's printed programme. Every fact an attendee needs is a time, and the organisers stamp it in ink. It refuses the conference default of a hero photo of a stage, a speaker-headshot grid and a ticket-tier pricing table.

OWN-WORLD: Goldenrod card-stock field. Slip-white ruled programme cards with red printed rules and caps. Violet stamp-pad ink for every time and status, with fresher ink darker (sessions already over fade to dry ink). Barlow Condensed for stamps and headings, Atkinson Hyperlegible Next for reading, Atkinson Hyperlegible Mono for typed details. At night the field becomes the ink pad (deep violet) and the ink turns goldenrod.

STORY: The visitor sees at once how long until the event, or what's on right now during it, then reads the full schedule, checks the venue, and registers. They believe the event is built for everyone. They register and get a REGISTERED stamp on their badge.

FIRST VIEWPORT: Left five of twelve columns: H1 "Wrenfield Frontend Day", a one-line lede with the date and venue, the violet Register button. Right seven: a tall programme slip. A live countdown or ON NOW stamp owns its top third at display scale, rotated about 3 degrees; the day at a glance is ruled below it with stamped times; a red printed note says entry is free and talks are captioned. The primary action sits above the fold at 1280 by 720.

FORM: Date-due slip and rubber stamp, position 3 on my grounded list, seed key 93f9943f, translated from the library subject to a conference programme and badge after the user changed the theme. Signature interaction: stamps press onto paper (live status on load, REGISTERED on submit), shown instantly under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Memorable moment

The REGISTERED stamp landing on the attendee badge after a successful registration.

## Unresolved

None.
