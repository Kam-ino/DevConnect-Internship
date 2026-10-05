# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- Frontend: React 19 + TypeScript (strict) + Vite. Asked for by the user: React (react-expert skill), three.js (threejs-geometry, threejs-animation) and Motion.
- Backend: a Node.js Express API that receives the video and splits it with ffmpeg (the user's choice over a Supabase-only backend).
- Data, files and auth: Supabase (Postgres with row-level security, Storage, email + password auth) on a cloud project the user creates and supplies keys for.
- Delegated to me: Vite, a single Node process that serves both the API and the app, and ffmpeg through the ffmpeg-static and ffprobe-static packages.
- Deploy target: one Render Web Service (the target used for the user's earlier projects).

## Users

- **Developers** who want frame-by-frame motion on their websites: they need a clip turned into a numbered image sequence (WebP or PNG at a set width), for example for a scroll-driven canvas animation.
- **Animators** studying motion: they step through a clip one frame at a time to read timing, poses and in-betweens.
- **Editors and designers**: they pull one exact, full-resolution still from footage for a thumbnail, poster or storyboard.
- The DevConnect internship reviewer, who runs the app from the README and checks that the failure paths behave.

## Product Purpose

Stillroom takes a video and breaks it into its frames. You upload a clip and it becomes a browsable contact sheet and a 3D stack of frames. You can step to any exact frame, keep the frames you want, and export them: one still as PNG or WebP, every kept still as a ZIP, or a frame range as a numbered image sequence for the web. Success means a user gets the exact frame or sequence they came for without opening a video editor.

## Positioning

A video is treated as a stack of stills, not a timeline to edit. Every export is an exact source frame, extracted at full resolution by ffmpeg on the server and identified by frame number and timecode, never a screenshot of a scaled preview. No AI anywhere: nothing is generated, upscaled or interpolated.

## Operating Context

- Desktop browser first. Mobile must work for browsing, keeping and downloading.
- Users arrive with a clip already on disk (MP4, MOV, WebM, MKV), often a short reference or a product shot.
- Developers take the ZIP straight into a codebase, so file names are zero-padded and in order, and there is a manifest.

## Capabilities and Constraints

- **Accounts:** email + password through Supabase Auth. Every video, frame bookmark and file is private to its owner, enforced in the database (row-level security) and in Storage policies, not just in the app.
- **Upload limits:** at most 50 MB (the free Supabase plan's file cap) and 5 minutes per video, and at most 5 videos per account. All three are enforced on the server or in the database, with messages that say which limit was hit.
- **Processing:** the server reads the video's metadata (ffprobe), stores the source in Supabase Storage, and renders contact sheets of up to 600 sampled thumbnails. It reports progress while it works. A failed or interrupted job can be retried or deleted.
- **Browsing:** a contact sheet grid, a 3D frame-stack view, and an inspector that steps one exact source frame at a time.
- **Keeping:** a kept frame is a bookmark (frame number + optional label). Keeping the same frame twice keeps it once.
- **Export:**
  - A single frame as PNG or WebP at full resolution.
  - All kept frames of a video as a ZIP.
  - A frame range as a numbered image sequence (WebP or PNG, chosen width and frame step) in a ZIP with a manifest.json.
  - Exports are generated on request and streamed. They are not stored.
- **Terminology:** "frame" means a frame of the source video, numbered from 0. "Contact sheet" is the thumbnail grid. "Kept" frames are bookmarks. "Sequence" is a range export for the web.
- **Out of scope:** AI features, editing or trimming video, audio, GIF or video export, sharing between users, teams.

## Brand Commitments

- **Name:** Stillroom. The name and identity come from the taste-skill brandkit pass the user asked for; the brand board lives in `brand/`.
- **Constraint from the user:** no AI integrations of any kind.

## Evidence on Hand

- No testimonials, customers, usage numbers or press exist. Do not invent any.
- No sample footage ships with the project. Test clips are generated with ffmpeg's built-in test sources.

## Product Principles

1. **Exact frames, never approximations.** A frame number always means the same source frame, in the inspector, in a kept frame and in every export.
2. **Say what failed and what to do.** Every failure (upload, processing, limits, session, network) names the cause and the next step. Nothing fails silently.
3. **Private by construction.** Ownership is enforced by the database and the storage policies, so a bug in the app can't leak someone else's footage.
4. **Narrow and finished.** Every listed capability is complete and documented; anything not built is named in the README's out-of-scope section.

## Accessibility & Inclusion

WCAG 2.2 AA:
- Full keyboard use, including frame stepping and the 3D view, which always has a non-3D equivalent.
- Visible focus.
- Reduced-motion support.
- Every state announced to screen readers.
