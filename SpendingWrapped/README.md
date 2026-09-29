# Spending Wrapped

Upload a year of spending as a CSV and get a year-in-review, like Spotify Wrapped for your bank account: total spent, biggest month, most-visited merchant and where the money went.

The upload returns `202 Accepted` straight away. A **separate worker process** imports the rows in the background, and it survives being killed halfway through a job. There's also an HTTP API with accounts and a live demo page at `/`.

- **Repository:** https://github.com/Kam-ino/DevConnect-Internship/tree/main/SpendingWrapped
- **Live demo:** https://YOUR-SERVICE.onrender.com. The free tier sleeps when nobody is using it, so the first request can take about a minute.

---

## Contents

1. [Quickstart: clone, run, call an endpoint](#1-quickstart)
2. [Configuration: every environment variable](#2-configuration)
3. [How it works and the data model](#3-how-it-works)
4. [API reference](#4-api-reference)
5. [What happens when the worker dies](#5-what-happens-when-the-worker-dies)
6. [Tests](#6-tests)
7. [Deploying](#7-deploying)
8. [What I would change at ten times the traffic](#8-what-i-would-change-at-ten-times-the-traffic)
9. [Limits and known issues](#9-limits-and-known-issues)

---

## 1. Quickstart

About five minutes. You don't need a database server, Docker or an account anywhere.

### Prerequisites

| Tool | Version | Check with | Notes |
|---|---|---|---|
| **Node.js** | **22.13.0 or newer, 22.x or 24.x.** Developed and tested on **22.22.2**. | `node -v` | The database is SQLite built into Node (`node:sqlite`). Node 20, and Node 22 before 22.13, **fail at startup** (see [section 9](#9-limits-and-known-issues)). Download from https://nodejs.org (choose the 22 LTS). |
| **npm** | **10.x** (comes with Node 22). Tested on **10.9.7**. | `npm -v` | |
| **Git** | Any 2.x. Tested on 2.43.0. | `git --version` | Only needed to clone. |
| **curl** | Any. Windows 10 and 11 already include it as `curl.exe`. | `curl --version` | Only for the example calls. PowerShell versions are given too. |

It works on Windows, macOS and Linux. The commands below are for **bash**: Git Bash on Windows, or Terminal on macOS and Linux. PowerShell versions follow each step.

### Step 1: Clone and install

```bash
git clone https://github.com/Kam-ino/DevConnect-Internship.git
cd DevConnect-Internship/SpendingWrapped
npm ci
```

You should see `added 68 packages`. The only dependency is Express.

### Step 2: Start the server

```bash
npm start
```

You should see:

```
[supervisor] started worker-1-1fb3 (pid 407)
Spending Wrapped listening on http://localhost:3000 (db: wrapped.db)
```

The worker id and pid will be different on your machine. No environment variables are needed. The first start creates `wrapped.db` in this folder. Leave this terminal running and open a second one for the next steps.

> If port 3000 is taken you get `EADDRINUSE`. Start it on another port instead: `PORT=3001 npm start` (bash), or `$env:PORT=3001; npm start` (PowerShell). Then use `3001` in the URLs below.

### Step 3: Call an endpoint

**Health check** (no login needed):

```bash
curl http://localhost:3000/health
```

```json
{"status":"ok","worker":{"id":"worker-1-1fb3","pid":407,"startedAt":"2026-09-29T21:50:36.249Z","alive":true}}
```

**Create an account.** This gives you a token:

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"reviewer@example.com","password":"correct horse battery"}'
```

```json
{"user":{"id":1,"email":"reviewer@example.com"},"token":"I13RgiOUICdENiFES9y1GGvOoWuF6gxEz4xzOs91EOY","expiresAt":"2026-10-06T21:50:39.043Z"}
```

Copy the `token` value. Then call a protected route, first without the token and then with it:

```bash
curl http://localhost:3000/me
# {"error":{"code":"unauthenticated","message":"This route needs a token. Send \"Authorization: Bearer <token>\"; ..."}}   (HTTP 401)

TOKEN=paste-your-token-here
curl http://localhost:3000/me -H "Authorization: Bearer $TOKEN"
# {"user":{"id":1,"email":"reviewer@example.com"},"transactions":0}                                                          (HTTP 200)
```

The same steps in **PowerShell**:

```powershell
Invoke-RestMethod http://localhost:3000/health
$r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/signup -ContentType 'application/json' `
     -Body '{"email":"reviewer@example.com","password":"correct horse battery"}'
$h = @{ Authorization = "Bearer $($r.token)" }
Invoke-RestMethod http://localhost:3000/me -Headers $h
```

### Step 4 (optional): Import the sample year and get your Wrapped

```bash
curl -s http://localhost:3000/sample.csv -o sample.csv
curl -X POST "http://localhost:3000/imports?filename=sample.csv" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/csv" \
  -H "Idempotency-Key: first-upload" --data-binary @sample.csv
# returns at once: {"id":1,"status":"queued","totalRows":1191, ...}   (HTTP 202)

curl http://localhost:3000/imports/1 -H "Authorization: Bearer $TOKEN"     # watch processedRows go up, about 10 s in total
curl http://localhost:3000/wrapped/2025 -H "Authorization: Bearer $TOKEN"  # the year-in-review
```

PowerShell:

```powershell
Invoke-WebRequest http://localhost:3000/sample.csv -OutFile sample.csv
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/imports?filename=sample.csv' -Headers $h `
  -ContentType 'text/csv' -InFile sample.csv
Invoke-RestMethod http://localhost:3000/wrapped/2025 -Headers $h
```

You can also open **http://localhost:3000** in a browser. The demo page does all of this with buttons, including one that crashes the worker mid-import.

### Stopping and resetting

Press `Ctrl+C` in the server terminal. To start from an empty database, stop the server and delete `wrapped.db`, `wrapped.db-wal` and `wrapped.db-shm`.

---

## 2. Configuration

Everything has a default, so **the service starts with no environment variables at all**. There is no `.env` file and no `.env.example`, because there are no secrets to put in one. Set variables in your shell: `PORT=3001 npm start` in bash, or `$env:PORT=3001` in PowerShell.

| Variable | Required? | Default | Where the value comes from | If it is missing or wrong |
|---|---|---|---|---|
| `PORT` | No | `3000` | **Render sets it automatically.** Locally you pick one. | Missing: uses 3000. Already in use: the server exits with `EADDRINUSE`. |
| `DB_FILE` | No | `wrapped.db` (in the folder you ran `npm start` from) | You choose it. It's a path to a SQLite file that is created if it doesn't exist. On Render, leave it unset. | Missing: uses `wrapped.db`. Set to `:memory:`: **the server refuses to start** (`DB_FILE must be a file: the web process and the worker process share it`), because two processes can't share an in-memory database. Folder not writable: startup fails with a SQLite error. |
| `ROW_DELAY_MS` | No | `8` | You choose it. It's an artificial pause per row so the demo import lasts about 10 s and you can watch or crash it. | Missing: `8`. Set `0` for full speed (the sample imports in well under a second). Not a number: treated as `0`. |
| `POLL_MS` | No | `250` | You choose it. It's how often an idle worker checks the queue for new jobs. | Missing: `250`. |
| `WORKER_ID` | **Don't set it** | *(set per worker)* | **The supervisor sets it** for each worker process it starts, e.g. `worker-2-ed3f`. | Setting it yourself has no effect on `npm start`. It is only read by `src/worker.js`. |

Things that are **not** configuration because they are not needed: API keys, a session-signing secret (tokens are random values looked up by their hash), and a database URL or password.

---

## 3. How it works

```
 POST /imports ──► web process ──► INSERT import (status = queued) ──► 202 Accepted   (≈10 ms)
                                        │
                                        ▼
                   worker process ──► claim job (15 s lease) ──► 50 rows ──► checkpoint ──► … ──► build Wrapped ──► done
                        ▲                                         (one transaction per batch)
                        │
                   supervisor (inside the web process): restarts the worker if it dies, and records the death on its jobs
```

`npm start` runs **one web process** (Express), and inside it a **supervisor** that `fork()`s **one worker process**. Both processes open the same SQLite file in WAL mode, so they can read and write it at the same time.

1. **The request only queues the job.** `POST /imports` checks that the header row names the right columns, stores the file, inserts a `queued` import and returns `202` with a `Location` header.
2. **The worker claims the job with a lease.** In one `BEGIN IMMEDIATE` transaction it sets `lease_owner = <worker id>` and `lease_expires_at = now + 15 s`.
3. **It works in batches of 50 rows, one transaction per batch.** The transaction inserts the rows (`INSERT … ON CONFLICT (user_id, row_key) DO NOTHING`), moves `processed_rows`, and renews the lease.
4. **At the end it rebuilds the Wrapped.** It recalculates the user's summary from all of their transactions, stores a SHA-256 **fingerprint** of it, and marks the job `done`.

**Running it twice gives the same result.** `row_key = sha256(date | merchant | amount | n)`, where `n` counts identical purchases within the file. Re-processing a row inserts nothing, and the summary is rebuilt from the table rather than added to. So a retry, a resumed crash, **Run again** or a duplicate upload all leave the same rows and the same fingerprint.

### Import lifecycle

```
queued ──► running ──► done
              │  ▲
              │  └── lease expired or worker died: reclaimed by the next worker (attempts + 1)
              └────► failed   (bad file, or 5 attempts used up)
done / failed ──► POST /rerun ──► queued
```

### Data model

SQLite with foreign keys switched on for every connection. The schema is in `src/db.js`.

| Table | Columns | Keys and constraints |
|---|---|---|
| `users` | `id`, `email`, `password_hash`, `created_at` | `email` is `UNIQUE`, case-insensitive. `password_hash` has the form `scrypt$N$r$p$salt$key`. |
| `sessions` | `token_hash`, `user_id`, `expires_at` | PK is `token_hash` (SHA-256 of the token). `user_id` → `users.id`. |
| `imports` | `id`, `user_id`, `idempotency_key`, `content_hash`, `filename`, `csv`, `status`, `total_rows`, `processed_rows`, `new_rows`, `duplicate_rows`, `invalid_rows`, `row_errors` (JSON, first 20), `attempts`, `run_count`, `lease_owner`, `lease_expires_at`, `last_error`, `summary_fingerprint`, `created_at`, `started_at`, `finished_at` | `user_id` → `users.id`. `UNIQUE (user_id, idempotency_key)`. `status` must be one of `queued`, `running`, `done`, `failed`. Indexed on `(status, lease_expires_at)` for claiming. |
| `import_events` | `id`, `import_id`, `at`, `kind`, `detail` | `import_id` → `imports.id`. This is the log you see in `GET /imports/:id`. |
| `transactions` | `id`, `user_id`, `import_id`, `row_key`, `date`, `merchant`, `category`, `amount_cents` | `UNIQUE (user_id, row_key)` makes re-runs harmless. `amount_cents > 0`. Indexed on `(user_id, date)`. |
| `summaries` | `user_id`, `year`, `data` (JSON), `fingerprint`, `built_at` | PK is `(user_id, year)`. |

Money is always stored as whole **centavos** (`INTEGER`), never as floating point.

---

## 4. API reference

### Conventions

- **Base URL:** `http://localhost:3000` locally.
- **Auth:** protected routes need `Authorization: Bearer <token>`. You get a token from `POST /auth/signup` or `POST /auth/login`, and it's valid for 7 days.
- **Request bodies** are JSON (`Content-Type: application/json`), except `POST /imports`, which takes the raw CSV (`Content-Type: text/csv`).
- **Every error has the same shape.** `code` never changes, so a program can check it. `message` tells a person what to do next. Extra fields carry the details needed to fix it.

  ```json
  { "error": { "code": "csv_missing_columns", "message": "The first row must name the columns. Missing: date, merchant, amount.",
               "missing": ["date","merchant","amount"], "expected": ["date","merchant","amount"], "found": ["when","shop","cost"] } }
  ```

**Errors any route can return:**

| Status | `code` | When | What the caller should do |
|---|---|---|---|
| 401 | `unauthenticated` | Protected route without an `Authorization: Bearer …` header. Also sends `WWW-Authenticate: Bearer`. | Log in and send the token. |
| 401 | `invalid_token` | The token is unknown, for example after logout. | Log in again. |
| 401 | `token_expired` | The token is older than 7 days. | Log in again. |
| 400 | `invalid_json` | The body isn't valid JSON. | Fix the JSON. |
| 404 | `route_not_found` | No such method and path. | Check this reference. |
| 413 | `payload_too_large` | The body is over 10 KB (auth routes) or 2 MB (`POST /imports`). | Send less. |
| 503 | `busy` | The database was locked for more than 5 s. Sends `Retry-After: 1`. | Retry after a second. |
| 500 | `internal_error` | A bug. It's logged on the server. | Retry, and report it if it keeps happening. |

---

### `POST /auth/signup`: create an account

**Body:** `{"email": "you@example.com", "password": "at least 8 characters"}`. The email is lower-cased. The password must be 8 to 200 characters.

**201 Created**

```json
{"user":{"id":1,"email":"reviewer@example.com"},"token":"I13Rgi…","expiresAt":"2026-10-06T21:50:39.043Z"}
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid_body` | The body isn't a JSON object, or `Content-Type` isn't JSON. |
| 400 | `validation_failed` | `field: "email"` means it isn't a valid email. `field: "password"` means it's shorter than 8 or longer than 200 characters. |
| 409 | `email_taken` | That email already has an account. Use `/auth/login`. |
| 429 | `rate_limited` | More than 30 sign-up or login attempts per minute from your IP. Includes `Retry-After` and `retryAfterSeconds`. |

### `POST /auth/login`: get a token

**Body:** `{"email": "...", "password": "..."}`

**200 OK** returns the same shape as sign-up.

| Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid_body`, `validation_failed` | As for sign-up. |
| 401 | `invalid_credentials` | Wrong email or password. You get the same answer either way, so the response doesn't reveal which emails have accounts. |
| 429 | `rate_limited` | As above. |

### `POST /auth/logout` 🔒: end this session

No body. Returns **204 No Content**. The token stops working immediately. Errors: `401`.

### `GET /me` 🔒: who am I

**200 OK**

```json
{"user":{"id":1,"email":"reviewer@example.com"},"transactions":1187}
```

Errors: `401`.

---

### `POST /imports` 🔒: upload a CSV (returns at once)

**Request:**

- **Body:** the CSV file itself, with `Content-Type: text/csv`. `text/plain` also works. Maximum 2 MB and 20,000 rows.
- **Query:** `?filename=my-bank.csv` is optional and used only for display.
- **Header:** `Idempotency-Key: <1–100 chars of A–Z a–z 0–9 . _ : ->` is optional. Retrying with the same key and the same file returns the original import instead of creating a new one.

**CSV format.** The first row must name the columns:

```
date,merchant,amount,category
2025-01-03,Starbucks BGC,185.00,
2025-01-03,Grab,236.50,Transport
```

- `date`: `YYYY-MM-DD` or `MM/DD/YYYY`. `posting date` and `transaction date` are also accepted as column names.
- `merchant`: also accepted as `description`, `payee`, `name`, `details` or `particulars`.
- `amount`: a positive number, and may include `₱` or `PHP` and thousands separators.
- `category` is optional. If it's empty, a category is guessed from the merchant name, for example Grab → Transport or Meralco → Bills & utilities.

Rows that fail validation don't fail the import. They are counted and explained in `rowErrors`.

**202 Accepted**, with header `Location: /imports/1`:

```json
{"id":1,"filename":"sample.csv","status":"queued","totalRows":1191,"processedRows":0,"newRows":0,"duplicateRows":0,
 "invalidRows":0,"rowErrors":[],"attempts":0,"runCount":1,"lastError":null,"summaryFingerprint":null,
 "createdAt":"2026-09-29T21:50:52.176Z","startedAt":null,"finishedAt":null,"links":{"self":"/imports/1","wrapped":"/wrapped"}}
```

A retry with the same `Idempotency-Key` and file also returns **202** with the same import, plus the header `Idempotent-Replayed: true`.

| Status | `code` | Meaning, and what to do |
|---|---|---|
| 400 | `csv_missing_columns` | The header row lacks `date`, `merchant` or `amount`. The response lists `missing`, `expected` and `found`. |
| 400 | `csv_empty` | There's no data row after the header. |
| 400 | `validation_failed` (`field: "Idempotency-Key"`) | The key has characters that aren't allowed or is too long. |
| 401 | *(see above)* | No token, or a bad one. |
| 413 | `too_many_rows` | More than 20,000 rows. Split the file. The response includes `limit`. |
| 413 | `payload_too_large` | Over 2 MB. |
| 415 | `unsupported_media_type` | The body wasn't sent as `text/csv`, for example as JSON or multipart form data. |
| 422 | `idempotency_key_reused` | That key was already used for a **different** file. Use a new key. The response includes `importId`. |

### `GET /imports` 🔒: your imports

**200 OK** returns `{"imports": [ …import objects, newest first, at most 50, without events… ]}`. You only ever see your own imports. Errors: `401`.

### `GET /imports/:id` 🔒: progress and history of one import

**200 OK** returns the import object plus `events`:

```json
{"id":1,"status":"done","totalRows":1191,"processedRows":1191,"newRows":1187,"duplicateRows":0,"invalidRows":4,
 "rowErrors":[{"row":41,"error":"date \"2025-02-30\" is not a valid YYYY-MM-DD or MM/DD/YYYY date"},
              {"row":301,"error":"amount is zero or negative; refunds and income are skipped"},
              {"row":611,"error":"amount \"TBA\" is not a number like 1234.50"},{"row":901,"error":"merchant is empty"}],
 "attempts":1,"runCount":1,"lastError":null,"summaryFingerprint":"fa0cc9f7be9a3f21…",
 "events":[{"at":"2026-09-29T21:50:52.176Z","kind":"queued","detail":"Upload accepted: 1191 rows. Waiting for a worker."},
           {"at":"2026-09-29T21:50:52.355Z","kind":"started","detail":"worker-1-1fb3 started the import (attempt 1)."}, "…"], "…": "…"}
```

**Fields of an import:**

| Field | Meaning |
|---|---|
| `status` | `queued`, `running`, `done` or `failed`. |
| `totalRows`, `processedRows` | Progress. `processedRows` is the last saved checkpoint. |
| `newRows` | Rows inserted in this run. |
| `duplicateRows` | Rows skipped because they were already imported. |
| `invalidRows` | Rows skipped because they failed validation. |
| `rowErrors` | The first 20 invalid rows, each with `row` (its position among the data rows) and `error`. |
| `attempts` | Workers that have picked up this run. More than 1 means something was retried or resumed. |
| `runCount` | How many times the import has been queued, including re-runs. |
| `lastError` | The last error message, if any. |
| `summaryFingerprint` | SHA-256 of your Wrapped after this run. |
| `events[].kind` | One of `queued`, `started`, `resumed`, `reclaimed`, `crash_requested`, `worker_died`, `paused`, `error`, `failed`, `rerun_requested`, `completed`. |

| Status | `code` | Meaning |
|---|---|---|
| 400 | `validation_failed` (`field: "importId"`) | The id isn't a positive integer. |
| 401 | | No token, or a bad one. |
| 404 | `not_found` | There's no such import **or it belongs to someone else**. The two cases give the same answer on purpose. |

### `POST /imports/:id/rerun` 🔒: process the whole file again

No body. Returns **202 Accepted** with the import back in `queued`. The result (rows and fingerprint) will not change. That is the point of the endpoint.

| Status | `code` | Meaning |
|---|---|---|
| 400, 401, 404 | | As for `GET /imports/:id`. |
| 409 | `import_in_progress` | It's still `queued` or `running`. Wait until it's `done` or `failed`. The response includes `status`. |

### `POST /imports/:id/crash-worker` 🔒: kill the worker (demo feature)

No body. It sends `SIGKILL` to the worker process that is running this import.

**202 Accepted**

```json
{"killed":{"id":"worker-1-9419","pid":990,"startedAt":"2026-09-29T21:09:05.287Z"},"importId":1,"processedRowsAtCrash":400}
```

| Status | `code` | Meaning |
|---|---|---|
| 400, 401, 404 | | As above. |
| 409 | `import_not_running` | The import isn't being processed right now, so there's nothing to kill. The response includes `status`. |
| 503 | `worker_unavailable` | No worker is attached. This only happens in the in-process tests. |

### `GET /wrapped` 🔒: all your years

**200 OK** returns `{"years":[2025], "fingerprint":"fa0cc9f7…", "summaries":[ …one per year, newest first… ]}`. If you have no data yet, the lists are empty and `fingerprint` is `null`. Errors: `401`.

### `GET /wrapped/:year` 🔒: one year

**200 OK**

```json
{"year":2025,"currency":"PHP","totalCents":58438875,"transactions":1187,"daysWithSpending":362,"averagePerDayCents":160107,
 "topMerchants":[{"merchant":"Robinsons Supermarket","totalCents":9390000,"visits":27}, "…4 more"],
 "mostVisited":{"merchant":"Grab","visits":160},
 "categories":[{"category":"Groceries","totalCents":16807400,"share":28.8}, "…"],
 "biggestMonth":{"month":"2025-12","totalCents":8327500},"busiestWeekday":{"day":"Friday","transactions":197},
 "biggestPurchase":{"date":"2025-12-02","merchant":"Uniqlo SM Megamall","amountCents":469725},
 "fingerprint":"07aaf324…","builtAt":"2026-09-29T21:51:01.934Z"}
```

| Status | `code` | Meaning |
|---|---|---|
| 401 | | No token, or a bad one. |
| 404 | `no_data_for_year` | Nothing imported for that year. The response lists `availableYears`. |

### Public routes (no token)

| Route | Returns |
|---|---|
| `GET /health` | **200** `{"status":"ok","worker":{"id","pid","startedAt","alive"}}` |
| `GET /sample.csv` | **200** `text/csv`: a made-up 2025 with 1,191 rows, 4 of them deliberately invalid. |
| `GET /` | The demo page. |
| `GET /README.md` | This file. |

---

## 5. What happens when the worker dies

| When it dies | What happens to the data | Who finds out |
|---|---|---|
| **In the middle of a batch** | SQLite rolls back the open transaction. That batch's rows and the checkpoint move are undone together. | The supervisor gets the `exit` event, releases the lease, and writes a `worker_died` event. It starts a new worker 1 s later. |
| **Between batches** | Nothing is lost. Everything up to the checkpoint is committed. | Same as above. |
| **The replacement takes over** | It continues from `processed_rows + 1`. Even if it re-read earlier rows, `ON CONFLICT DO NOTHING` would skip them. | `reclaimed` and `resumed` events, e.g. "resumed from row 401 of 1191 (attempt 2)". |
| **The whole machine dies**, supervisor included | Nobody releases the lease, so it **expires after 15 s**. The next worker to start treats it as abandoned. | `reclaimed` event, and `attempts` goes up. |
| **A stale worker wakes up** and keeps writing | Each checkpoint is `UPDATE … WHERE lease_owner = me`. It matches 0 rows, so the whole batch rolls back. | That worker stops. There's a test for this. |
| **It keeps crashing on the same job** | After **5 attempts** the job becomes `failed` with `lastError`. | `failed` event: "Gave up after 5 attempts… Press Run again to retry." |
| **The web process dies** | The worker sees its parent disconnect, finishes the current batch, releases its lease and exits. | `paused` event with the row it stopped at. |

**Real run.** An import killed at row 400, from `GET /imports/1`:

```
21:09:07.217 queued           Upload accepted: 1191 rows. Waiting for a worker.
21:09:07.356 started          worker-1-9419 started the import (attempt 1).
21:09:10.471 crash_requested  Crash button pressed: sending SIGKILL to worker-1-9419 (pid 990) at row 400 of 1191.
21:09:10.475 worker_died      worker-1-9419 was killed (SIGKILL) with 400 of 1191 rows saved. Rows after the last checkpoint were rolled back; the job goes back in the queue.
21:09:11.538 reclaimed        The lease held by worker-1-9419 had expired, so worker-2-ed3f took the job over.
21:09:11.538 resumed          worker-2-ed3f resumed from row 401 of 1191 (attempt 2).
21:09:17.920 completed        Processed 1191 rows: 1187 new, 0 already imported, 4 invalid. Wrapped fingerprint fa0cc9f7be9a.
```

`fa0cc9f7be9a…` is the same fingerprint that a clean run with no crash produces. Running it again (`/rerun`) gives `newRows: 0, duplicateRows: 1187` and the same fingerprint.

---

## 6. Tests

```bash
npm test
```

This runs 28 tests in about 10 s. They need no network and no configuration. Each test uses its own temporary database.

| File | What it proves |
|---|---|
| `test/auth.test.js` | Every protected route returns `401` without a token, and for bad or expired tokens. Passwords and tokens are stored only as hashes. Sign-up and login errors. Rate limiting. |
| `test/imports.test.js` | The upload returns `202` before any row is imported. Run again, a duplicate upload, and two workers holding one job all give the same rows and fingerprint. The job gives up after 5 attempts. `Idempotency-Key` behaviour, including 5 simultaneous retries. Upload errors. User B can't see user A's data. |
| `test/crash.test.js` | Starts the **real** server and worker, `SIGKILL`s the worker mid-import, and checks the resume point, the event log, the row counts, and a fingerprint equal to a clean run. |
| `test/secrets.test.js` | No `.env` file, and nothing that looks like a key or hard-coded credential in the project. |

---

## 7. Deploying

On Render (free tier): **New → Web Service**, connect the repository, then use these settings.

| Setting | Value |
|---|---|
| Root Directory | `SpendingWrapped` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Environment variables | none (Render provides `PORT`) |

The Node version comes from `"engines": {"node": ">=22.13 <25"}` in `package.json`.

---

## 8. What I would change at ten times the traffic

Today's design is sized for a demo: one machine, one worker, one SQLite file. This is what would break first as traffic grows, and what I'd change.

| Today | Why it stops working at 10× | Change |
|---|---|---|
| **SQLite, one file on one machine** | Only one writer at a time. Every batch takes the write lock, so sign-ups and uploads queue behind the imports. It also can't be shared by two machines. | **Postgres.** The lease, checkpoint and unique-key design carries over as it is. Claiming becomes `SELECT … FOR UPDATE SKIP LOCKED`. |
| **One worker process** | Imports run one at a time. A 20,000-row file makes everyone else wait. | **N workers**, on separate machines if needed. The claiming is already safe for that. Add a per-user limit so one user can't fill the queue. |
| **Workers poll every 250 ms** | Idle polling from many workers becomes pointless database load. | Postgres `LISTEN/NOTIFY`, or a real queue (SQS, or Redis with BullMQ), keeping the database row as the source of truth. |
| **The CSV is stored in the `imports` row** | 2 MB rows bloat the database and backups. | Put the file in object storage (S3 or R2) and keep only its key and hash in the row. |
| **The Wrapped is rebuilt from all of a user's transactions after every import** | The cost grows with the user's entire history, not with the new file. | Recompute only the years the import touched, or keep running totals per (user, year, merchant) and (user, year, category). |
| **The rate limiter lives in process memory** | With several web instances each keeps its own count, and restarts reset it. | A shared counter in Redis, or rate limiting at the edge or load balancer. |
| **Each request looks up its session in the database** | That's one extra query on every request. | Cache session lookups briefly, or use short-lived signed tokens (which then need a secret and a revocation plan). |
| **The crash button is available to every user** | On a shared deployment one person's click delays everyone's imports. | Remove it, or restrict it to admins. Use chaos tests in staging instead. |
| **Worker events only go to the import log** | Nobody is alerted when workers keep dying. | Metrics (queue depth, job duration, attempts) and an alert on `failed` jobs and on worker restarts per minute. |

---

## 9. Limits and known issues

What this project does **not** do, and what is known to be wrong. Read this before relying on it.

**Known broken or surprising**

- **`DD/MM/YYYY` dates are not supported.** A slash date is always read as `MM/DD/YYYY`. `31/01/2025` is rejected as invalid, and `03/01/2025` is imported as **March 1** rather than January 3. Many Philippine and European bank exports use day first. Convert them to `YYYY-MM-DD` before uploading.
- **Duplicate detection can undercount across overlapping files.** A row is identified by date, merchant, amount and how many times that exact combination appears **in the same file**. Suppose you really bought two identical ₱185 coffees on the same day, but each one only appears in a different export. The second file's coffee is treated as the same purchase and skipped.
- **Node versions before 22.13 fail at startup** with `No such built-in module: node:sqlite`, because `node:sqlite` needs a flag before 22.13. `npm` only prints an `EBADENGINE` warning, so this is easy to miss. Run `node -v` first.
- **On Render's free tier the data does not survive.** The disk is wiped on every restart or redeploy, including after the service sleeps, so accounts and imports disappear.
- **A batch that takes more than 15 s** loses its lease to another worker. For example, this could happen on a very slow disk. The data stays correct, because the slow worker's checkpoint is rejected, but the work is done twice.
- **Pressing Crash the worker kills the one shared worker.** Every user's queued imports wait about a second while the replacement starts.
- **Tests have only been run on Linux** (Node 22.22.2). They spawn processes and send `SIGKILL`/`SIGTERM`. Node emulates these on Windows, but the crash test has not been verified there.

**Not supported, by design or not yet built**

- Income, refunds and transfers. Only positive amounts count as spending, and negative or zero amounts are skipped with a row error.
- Currencies other than PHP. Every amount is assumed to be pesos.
- Excel (`.xlsx`) files, PDFs or bank-specific formats. CSV only, at most 2 MB and 20,000 rows.
- Deleting an import or transaction, or editing a category after import.
- Password reset, email verification, changing your email, deleting your account, or listing and revoking your other sessions (logout only ends the current one).
- Time zones. Dates are calendar dates as written in the file.
- More than one worker. Imports are processed one at a time, in upload order.
- Only the first 20 invalid rows are listed in `rowErrors`, although `invalidRows` counts all of them.
- Categories come from keyword rules (`src/categorize.js`) tuned for common Philippine merchants. Anything unrecognised becomes **Other**.
