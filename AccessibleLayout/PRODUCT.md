# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React, JavaScript (user's choice). Replaces the earlier static HTML/CSS/JS version of this page.

## Users

- **Real audience:** DevConnect internship reviewers assessing frontend-track work on accessible layout.
- **Fictional audience the page serves** (inferred from the existing content, kept by the user): residents near Wrenfield Library's Harbor Road branch who want to check opening hours, find a free event, or apply for a library card. They include parents of young children, older readers, low-vision readers and people who don't have a card yet. Many arrive on a phone.

## Product Purpose

A one-page site for Wrenfield Library, a fictional neighbourhood library, built as a practice project in accessible layout. Success means a visitor can find today's hours, what's on and how to get a card within seconds, using a mouse, keyboard, touch or screen reader, at any zoom level, in light or dark mode. The build must pass WCAG 2.2 AA.

## Positioning

A library that lets everyone in, card or no card, presented on a page built so that everyone can use it. The accessibility is the subject of the work, not a feature added at the end.

## Operating Context

- Reviewers run it locally (`npm run dev`) and check it with the keyboard, axe and narrow viewports.
- Fictional visitors read it on phones and desktops, often quickly (checking whether the library is open now).

## Capabilities and Constraints

- Content: opening hours by day, a closure notice, four October 2026 events, four common questions, a library card application form, address and contact details.
- The form is front end only. Nothing is sent or stored.
- No backend, no accounts, no CMS.
- Fictional details must stay obviously safe: phone numbers in the 555-01xx range, email on a `.example` domain, and a visible note that the library is fictional.

## Brand Commitments

- Name: Wrenfield Library, Harbor Road branch. No logo exists.
- Voice: plain language, short sentences, friendly and direct, no jargon (as in the existing copy).

## Evidence on Hand

- Photos: Unsplash via Lorem Picsum (ids 192 reading room, 367 e-reader, 24 open book), credited in the README.
- No real visitors, reviews, statistics, awards or partners exist. Do not invent any.

## Product Principles

1. Accessibility is the floor and the subject: WCAG 2.2 AA, verified rather than assumed.
2. Information before persuasion: hours, events and the card form are reachable immediately.
3. Plain language over cleverness.
4. Honest about being fictional and front-end only.

## Accessibility & Inclusion

WCAG 2.2 AA is required. Verify with axe, keyboard-only use, 320px reflow, both colour schemes and reduced motion. The audience explicitly includes low-vision and screen-reader users.
