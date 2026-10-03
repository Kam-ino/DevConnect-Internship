# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React, JavaScript (user's choice). Replaces the earlier static HTML/CSS/JS version of this page.

## Users

- **Real audience:** DevConnect internship reviewers assessing frontend-track work on accessible layout. The assignment theme is "Conference Schedule".
- **Fictional audience the page serves:** people planning to attend Wrenfield Frontend Day, in person or online. They want to know when it is, what's on and when, whether the venue works for them, and how to register. Some are disabled, some use screen readers or magnification, and many check the schedule on a phone during the day itself.

## Product Purpose

A one-page site for Wrenfield Frontend Day, a fictional free one-day conference about building accessible websites, built as a practice project in accessible layout. Success means a visitor can see within seconds how long until the event (or what's on right now during it), read the full two-room schedule, check the venue's access details and register, using a mouse, keyboard, touch or screen reader, at any zoom level, in light or dark mode. The build must pass WCAG 2.2 AA.

## Positioning

A conference about accessible web design whose own schedule page is built to the standard it teaches. The accessibility is the subject of the work, not a feature added at the end.

## Operating Context

- Reviewers run it locally (`npm run dev`) or on the deployed static site and check it with the keyboard, axe and narrow viewports. A `?now=` URL parameter lets them preview the page at any moment of the conference day.
- Fictional attendees read it ahead of time on desktop, and on the day on their phones, between talks.

## Capabilities and Constraints

- Content: one conference day (Thursday 15 October 2026), a live countdown or "on now" status, the day at a glance, a full schedule with two parallel rooms plus shared sessions, venue and access details, four common questions, a registration form, contact details.
- The form is front end only. Nothing is sent or stored.
- No backend, no accounts, no CMS.
- Times are treated as the visitor's local time (a simplification for a practice project).
- Fictional details must stay obviously safe: email on a `.example` domain and a visible note that the conference is fictional. Speaker names are invented and must not belong to well-known real people.

## Brand Commitments

- Name: Wrenfield Frontend Day 2026, held at Harbor Hall, 418 Harbor Road, Wrenfield. No logo exists.
- Voice: plain language, short sentences, friendly and direct, no jargon.

## Evidence on Hand

- Photo: the reading-room photo by Adam Przewoski (Unsplash), bundled in `src/assets/` with its origin embedded and credited in the README. It stands in for the venue.
- No real speakers, attendee numbers, sponsors, reviews or past-event statistics exist. Do not invent any.

## Product Principles

1. Accessibility is the floor and the subject: WCAG 2.2 AA, verified rather than assumed.
2. The schedule comes first: when and what is reachable immediately, and "what's on now" is answered without reading the whole table.
3. Plain language over cleverness.
4. Honest about being fictional and front-end only.

## Accessibility & Inclusion

WCAG 2.2 AA is required. Verify with axe, keyboard-only use, 320px reflow, both colour schemes and reduced motion. The schedule table must keep its row and column headers for screen readers at every width. The audience explicitly includes low-vision and screen-reader users.
