# Stillroom

**Motion, held still.** Stillroom breaks a video into its frames. Upload a clip and it becomes a numbered contact sheet and a 3D rack of glass plates. You can:
- step to any exact frame, with a measuring grid over it if you want one;
- keep the frames you need;
- download a frame as a full-resolution PNG or WebP;
- download every kept frame as a ZIP;
- export a frame range as a numbered image sequence, with a manifest, ready for frame-by-frame animation on a website.

Full-stack: a React front end, a Node.js + Express API that does the video work with ffmpeg, and Supabase for the database, file storage and sign-in. There are no AI features: nothing is generated, upscaled or interpolated. Every image is an exact source frame.

## The problem it solves

Getting one exact frame out of a video usually means opening an editor, scrubbing, and screenshotting a scaled preview. You get the wrong frame or the wrong resolution. Three groups hit this:

- **Developers** building scroll-driven "frame-by-frame" animations need a clip as a numbered image sequence at a sensible width (WebP keeps it light), plus the frame order and timing.
- **Animators** studying motion need to step one frame at a time and measure positions between frames.
- **Editors and designers** need one exact, full-resolution still for a thumbnail, poster or storyboard.

Stillroom identifies every frame by number and timecode, and every export is that exact frame, extracted by ffmpeg from the original file.

## Running it locally

You need **Node.js 24** (the server runs TypeScript directly) and a free **Supabase** project. ffmpeg comes with the npm install (`ffmpeg-static`, `ffprobe-static`), so you don't need to install it separately.

1. **Install:**
   ```bash
   cd Stillroom
   npm install
   ```
2. **Create the database.** In your Supabase project, open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and run it. It creates:
   - the `videos` and `kept_frames` tables, their row-level security and the triggers that enforce the limits;
   - the private `media` storage bucket and its policies.

   It's safe to run again.
3. **Connect it.** Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY`, from Project Settings → API. Stillroom only needs the public anon key, never the service-role key.
4. **Start it:**
   ```bash
   npm run dev
   ```
   Open http://localhost:8787. One process serves both the API and the app (Vite runs inside Express), so there's only one port.
5. **Create an account** on the sign-in screen. If your project has "Confirm email" switched on (Authentication → Providers → Email), Stillroom tells you to check your inbox first. Switch it off for quicker local testing.

Other commands:

```bash
npm test           # 20 tests: frame maths, the ffmpeg pipeline, the ZIP writer, and the database schema
npm run typecheck  # strict TypeScript across the app, the server and the tests
npm run build      # type-checks, then builds the app into dist/
npm start          # production mode: serves dist/ and the API on PORT (default 8787)
```

Need a test clip? This makes a 10-second 1080p one with ffmpeg's built-in test pattern:

```bash
node -e "require('child_process').spawnSync(require('ffmpeg-static'),['-f','lavfi','-i','testsrc2=s=1920x1080:r=24:d=10','-pix_fmt','yuv420p','test-clip.mp4'],{stdio:'inherit'})"
```

### Deploying (Render)

Create a **Web Service** with root directory `Stillroom`, build command `npm install && npm run build`, start command `npm start`, and environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The free tier works, but its CPU is small, so processing a long 1080p clip can take a few minutes. The app shows progress the whole time.

## How to use it

1. **Library:** drop a video in, or press **Choose a video**. You'll see upload progress, then "Printing the contact sheet" with a percentage while the server processes it.
2. **Open** a processed video. The **inspector** shows the current frame at full quality. The **contact sheet** below it shows every frame of short clips; long clips are sampled, down to at most 600 thumbnails.
3. Step with the arrow keys, or type a frame number. Press **G** for the measuring grid. **Plate rack** shows the same frames in 3D: scroll or drag to flip through, click a plate to open it.
4. Press **K** (or **Keep frame**) to keep a frame. Kept frames can have labels, can be downloaded one by one, or all at once as a ZIP.
5. **Image sequence:** set the start and end (**I** and **O** use the current frame), the step, the width and the format, then **Download ZIP**. The ZIP holds `name_0000.webp`, `name_0001.webp` and so on, plus `manifest.json` with each file's source frame number and timestamp. **Play it on a website** shows a ready-made scroll-scrubbing snippet.

## Limits and failure paths

Each failure says what happened and what to do next. Nothing fails silently.

| Situation | What happens |
|---|---|
| File over **50 MB** | Refused before upload (in the browser), and again on the server, which counts bytes as they arrive and cuts the upload off at 50 MB. The message names the file's size. |
| Video over **5 minutes** | Refused after reading its metadata: "This video runs 412 seconds…". |
| Not a video, or an unsupported container | ffprobe can't read it, so: "This file isn't a video Stillroom can read. Try an MP4, MOV, WebM or MKV file." |
| A 6th video on one account | The **database** refuses it (a trigger with an advisory lock, so two simultaneous uploads can't both get past the limit). The app says to delete one first. |
| Upload interrupted or cancelled | "The upload was interrupted…", with **Try again** for the same file. |
| Processing fails (a damaged file) | The video is marked failed, with the reason, and **Retry** and **Delete** buttons. |
| Server restarts mid-processing | After 2 minutes without progress, the library shows "Processing was interrupted" with **Retry**. Processing restarts from the copy in storage. |
| Session expires | The next request signs you out, and the sign-in screen says why. |
| Supabase or the server unreachable | Every request reports that it couldn't reach Supabase or the server. With no `.env`, the app shows a setup screen that explains how to connect it. |
| Keeping the same frame twice | Kept once (a unique constraint), even from two tabs. |
| More than 600 kept frames, or a sequence over 600 frames | Refused with a message saying what to change: remove some, raise the step, or shorten the range. |
| Asking for a frame that doesn't exist | 404 with the valid range: "Frames in this video run from 0 to 239." |
| WebGL unavailable | The plate rack explains it can't run here; the contact sheet shows the same frames. |

## How it works

- **Upload** (`POST /api/videos`): the raw file is streamed to disk, and ffprobe reads its metadata. The server then inserts the `videos` row, stores the original in Supabase Storage, and responds.
- **Processing** happens in the background. **One ffmpeg pass** does two jobs:
  - `showinfo` records every decoded frame's timestamp, saved as `frames.json`;
  - `select` + `scale` + `tile` render the thumbnails into contact sheets (10×10 JPEG grids).

  Progress is written to the row every 1.5 seconds; the app polls it.
- **Exact frames:** to extract frame *k*, ffmpeg seeks to the midpoint between frame *k−1* and frame *k*'s timestamps. Rounding can't land on a neighbour, even with variable frame rates or B-frames. `test/media.test.ts` proves it: on a generated clip, frame *k* has brightness 8·*k*, and every extracted frame is checked against that.
- **Exports:**
  - a single frame streams straight back as PNG or WebP;
  - ZIPs are written as they stream, by a small stored-entry ZIP writer (`server/zip.ts`) built on Node's `zlib.crc32`.

  Nothing is stored for exports.
- **The server never holds a Supabase service key.** It acts with the signed-in user's own token, verified with `auth.getClaims()`, so row-level security and the storage policies apply to the server too.
- **Plate rack** (`src/components/PlateRack.tsx`, three.js):
  - one `InstancedMesh` per contact sheet;
  - each plate cuts its own tile from the sheet texture in a small shader;
  - all plates follow one damped "rack position", so flipping is one continuous motion;
  - it only renders while something is moving, loads only when opened (lazy chunk), and respects reduced-motion settings.

## Database design

The schema is in [`supabase/schema.sql`](supabase/schema.sql), and `test/schema.test.ts` checks it on a real Postgres (PGlite).

- **Ownership:** row-level security on `videos` and `kept_frames`, plus storage policies that only allow files inside the folder of a video row you own (`<user id>/<video id>/…`). Another account can't see, change, delete or claim anything. Policies call `(select auth.uid())` so it's evaluated once per query (an InitPlan), not once per row.
- **Limits in the database:** check constraints for size (≤ 50 MB), length (≤ 5 min) and field ranges. Triggers enforce 5 videos per account, frames that exist, and ≤ 600 kept frames per video. A unique `(video_id, frame_index)` key makes keeping a frame idempotent.
- **One index per access path:**

  | Query | Index |
  |---|---|
  | The library: a user's videos, newest first | `videos (user_id, created_at desc)`, which also covers the `user_id` foreign key |
  | The workspace: a video's kept frames in order | the unique `kept_frames (video_id, frame_index)` key |
  | Cascade deletes when an account is removed | `kept_frames (user_id)` |

  The test seeds 300 accounts (1,500 videos, 45,000 kept frames) and asserts with `EXPLAIN` that both app queries use their index, with `auth.uid()` as an InitPlan.

## Accessibility

- **Keyboard:** everything works from the keyboard, including frame stepping. The keys are listed in the workspace's Keyboard panel.
- **Screen readers:** frame changes are announced; uploads, errors and actions use status and alert regions; controls have labels.
- **Visual:** visible focus, and WCAG AA contrast on both the black stage and the buff mount.
- **Motion and 3D:** animation respects `prefers-reduced-motion`. The 3D rack always has a 2D equivalent, the contact sheet.

## Project layout

```
Stillroom/
  server/      Express API (app.ts), ffmpeg (media.ts), processing + cache (jobs.ts), Supabase access, ZIP writer
  shared/      frame maths and types used by both sides (frames.ts, types.ts)
  src/         React app: pages (SignIn, Library, Workspace) and components (Inspector, ContactSheet, PlateRack, …)
  supabase/    schema.sql: tables, RLS, triggers, indexes, storage bucket and policies
  test/        node:test suites (frames, media, zip, schema)
  brand/       the Stillroom brand board
```

## Out of scope

Deliberately not built:

- **AI of any kind:** no upscaling, interpolation, generated frames, or "smart" frame picking.
- **Editing video:** no trimming, cropping, filters, audio, or re-encoding to a new video.
- **GIF, MP4 or sprite-sheet export:** exports are still images (PNG/WebP) and ZIPs of them.
- **Sharing:** every video is private to its owner. No public links, teams, or collaboration.
- **Larger files:** 50 MB and 5 minutes are hard limits, set by the free Supabase plan's file cap and a small server. A paid plan would need larger storage limits and a job queue.
- **Durable background jobs:** processing runs in the server process. If the server restarts mid-job, the video shows as interrupted with a Retry button; there is no external queue.
- **Account management:** no password reset screen, email change or account deletion in the app. Supabase's dashboard covers these for now.
- **Offline use:** every action needs the server and Supabase.
