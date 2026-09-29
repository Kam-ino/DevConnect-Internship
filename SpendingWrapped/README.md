# Spending Wrapped

Upload a year of spending as a CSV and get a year-in-review, like Spotify Wrapped but for your bank account: total spent, biggest month, most-visited merchant, where the money went.

The point of the project is what happens **after the response is sent**. The upload returns `202 Accepted` in a few milliseconds. A **separate worker process** imports the rows in the background, categorises each merchant, and builds the summary. That worker can be killed at any moment, including on purpose from the demo page, and the import still finishes with exactly the same result.

**Live demo:** https://YOUR-SERVICE.onrender.com. Create a throwaway account, press **Import the sample CSV**, then **Crash the worker now** while it runs.

**Stack:** Node.js 22.13+ · Express 5 · SQLite (`node:sqlite`, no native dependencies) · the web process runs a supervised worker process (`child_process.fork`) · no external services.

## Running it

```bash
npm install
npm start      # http://localhost:3000, creates wrapped.db on first run
npm test       # 28 tests, including a real SIGKILL of the worker mid-import
```

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DB_FILE` | `wrapped.db` | SQLite file shared by the web and worker processes |
| `ROW_DELAY_MS` | `8` | Artificial work per row, so a 1,191-row import takes about 10 s and you can watch it (and crash it). Set to `0` for full speed. |

No secrets are needed. There are no API keys. Passwords are hashed with a random salt per user, and session tokens are random and stored only as a SHA-256 hash (see [Accounts](#accounts)).

## How it works

```
 POST /imports ──► web process ──► INSERT import (status = queued) ──► 202 Accepted   (≈10 ms)
                                        │
                                        ▼
                   worker process ──► claim job (lease 15 s) ──► 50 rows ──► checkpoint ──► 50 rows ──► … ──► build Wrapped ──► done
                        ▲                                          (one transaction each)
                        │
                   supervisor (in the web process): restarts the worker if it dies, and records the death on its jobs
```

1. **The request only queues.** `POST /imports` checks the header row, stores the file and a `queued` job, and returns `202` with a `Location: /imports/:id`. The request never processes rows.
2. **The worker claims the job with a lease.** It sets `lease_owner` and `lease_expires_at = now + 15 s` in one `BEGIN IMMEDIATE` transaction, so two workers can never claim the same job at the same moment.
3. **The work happens in batches of 50 rows, and each batch is one transaction.** The transaction inserts the rows, moves the checkpoint (`processed_rows`) and renews the lease. A batch is either fully saved together with its checkpoint, or not saved at all.
4. **At the end** the worker rebuilds the user's Wrapped from all of their transactions, stores a SHA-256 **fingerprint** of it, and marks the job `done`.

## Running the work twice gives the same result

Every transaction gets a `row_key`: a hash of `date | merchant | amount | n`, where `n` counts identical purchases within the same file. Two ₱150 coffees on the same day are two different rows. The same line seen again is the same row. The database has `UNIQUE (user_id, row_key)`, and rows are written with `INSERT … ON CONFLICT DO NOTHING`.

So re-processing any row, whether from a retry, a crash, **Run again** or uploading the same file twice, adds nothing. The Wrapped is rebuilt from the table rather than incremented, so it can't be counted twice either. The fingerprint proves it: it is identical after every run.

## What happens when the worker dies halfway through

This is shown step by step on the demo page, and `test/crash.test.js` checks it against the real processes.

| When it dies | What happens | Who finds out |
|---|---|---|
| **In the middle of a batch** | SQLite rolls back the open transaction, so none of that batch's rows are saved and the checkpoint doesn't move. | The supervisor gets the process's `exit` event. It immediately releases the job's lease and writes a `worker_died` event on the import: *"worker-1 was killed (SIGKILL) with 400 of 1191 rows saved"*. It starts a new worker one second later. |
| **Between two batches** | Nothing is lost: everything up to the checkpoint is committed. | Same as above. |
| **The new worker picks it up** | It claims the job, sees `processed_rows = 400`, and continues from row 401. Rows before that are never re-read. Even if they were, `ON CONFLICT DO NOTHING` would skip them. | `reclaimed` and `resumed` events: *"worker-2 resumed from row 401 of 1191 (attempt 2)"*. |
| **The whole machine dies** (so the supervisor dies too) | Nothing releases the lease, but it **expires after 15 seconds**. The next worker to start treats an expired lease as abandoned and takes the job over. | `reclaimed` event, and `attempts` goes up. |
| **An old worker comes back** and tries to keep writing | Every checkpoint is `UPDATE … WHERE lease_owner = me`. If someone else holds the lease, that update matches 0 rows, and the whole batch rolls back. | The old worker stops. A test covers this: *"two workers holding the same job"*. |
| **It keeps dying on the same job** | After **5 attempts** the job is marked `failed` with `last_error`, and it stays that way instead of retrying forever. | `GET /imports/:id` shows `status: "failed"` and an event: *"Gave up after 5 attempts. Saved progress: row N of M. Press Run again to retry."* |
| **The web process dies** | The worker notices its parent disconnected and stops after the current batch, releasing its lease. When the host restarts the service, a new worker resumes. | `paused` event with the row it stopped at. |

So a crash is never silent. Every crash, takeover, retry and final give-up is written to the import's event log, which the owner can read at `GET /imports/:id` and which the demo page shows as a timeline.

### Demonstration (real output)

Run against a local server started with `npm start`.

**1. Without a token → 401**

```
$ curl -i localhost:3000/imports
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer
Content-Type: application/json; charset=utf-8

{"error":{"code":"unauthenticated","message":"This route needs a token. Send \"Authorization: Bearer <token>\"; get a token from POST /auth/login or POST /auth/signup."}}
```

**2. Sign up, then upload the 1,191-row sample: 202 in 8 ms**

```
$ curl -s -X POST localhost:3000/auth/signup -H 'Content-Type: application/json' \
    -d '{"email":"kamino@example.com","password":"correct horse battery"}'
{"user":{"id":1,"email":"kamino@example.com"},"token":"jwYTh1Mx…","expiresAt":"2026-10-06T21:09:07.143Z"}

$ curl -s localhost:3000/sample.csv -o sample.csv
$ curl -s -w '\nHTTP %{http_code} in %{time_total}s\n' -X POST "localhost:3000/imports?filename=sample.csv" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: text/csv' -H 'Idempotency-Key: kamino-2025' \
    --data-binary @sample.csv
{"id":1,"filename":"sample.csv","status":"queued","totalRows":1191,"processedRows":0, … }
HTTP 202 in 0.008126s
```

**3. Three seconds later it is at row 400, so we kill the worker**

```
$ curl -s localhost:3000/imports/1 -H "Authorization: Bearer $TOKEN"
{"status":"running","processedRows":400,"totalRows":1191, … }

$ curl -s -X POST localhost:3000/imports/1/crash-worker -H "Authorization: Bearer $TOKEN"
{"killed":{"id":"worker-1-9419","pid":990,"startedAt":"2026-09-29T21:09:05.287Z"},"importId":1,"processedRowsAtCrash":400}
```

Server log:

```
[supervisor] worker-1-9419 was killed (SIGKILL); released 1 job(s): 1
[supervisor] started worker-2-ed3f (pid 1021)
```

**4. The import's own record of what happened**

```
$ curl -s localhost:3000/imports/1 -H "Authorization: Bearer $TOKEN"
status: done   processedRows: 1191   newRows: 1187   invalidRows: 4   attempts: 2
summaryFingerprint: fa0cc9f7be9a3f21eaa8dfdc2a6d36bd361eb835b1599406e461dbf1070e5d94

21:09:07.217 queued           Upload accepted: 1191 rows. Waiting for a worker.
21:09:07.356 started          worker-1-9419 started the import (attempt 1).
21:09:10.471 crash_requested  Crash button pressed: sending SIGKILL to worker-1-9419 (pid 990) at row 400 of 1191.
21:09:10.475 worker_died      worker-1-9419 was killed (SIGKILL) with 400 of 1191 rows saved. Rows after the last checkpoint were rolled back; the job goes back in the queue.
21:09:11.538 reclaimed        The lease held by worker-1-9419 had expired, so worker-2-ed3f took the job over.
21:09:11.538 resumed          worker-2-ed3f resumed from row 401 of 1191 (attempt 2).
21:09:17.920 completed        Processed 1191 rows: 1187 new, 0 already imported, 4 invalid. Wrapped fingerprint fa0cc9f7be9a.
```

The fingerprint `fa0cc9f7be9a…` is the same one a clean, never-crashed run of the same file produces. `test/crash.test.js` checks this on every run.

**5. Run the whole import again: same result**

```
$ curl -s -X POST localhost:3000/imports/1/rerun -H "Authorization: Bearer $TOKEN"     # HTTP 202
$ curl -s localhost:3000/imports/1 -H "Authorization: Bearer $TOKEN"
{"status":"done","runCount":2,"newRows":0,"duplicateRows":1187,"invalidRows":4,
 "summaryFingerprint":"fa0cc9f7be9a3f21eaa8dfdc2a6d36bd361eb835b1599406e461dbf1070e5d94"}
```

**6. Retrying the upload with the same `Idempotency-Key`: no second import**

```
$ curl -s -D - -o /dev/null -X POST "localhost:3000/imports?filename=sample.csv" … -H 'Idempotency-Key: kamino-2025' --data-binary @sample.csv
HTTP/1.1 202 Accepted
Idempotent-Replayed: true
Location: /imports/1
```

## Accounts

- `POST /auth/signup` and `POST /auth/login` return a random 256-bit **Bearer token**, valid for 7 days. `POST /auth/logout` deletes it.
- Passwords are hashed with **scrypt** (N=16384, r=8, p=1) and a random 16-byte salt per user. Login compares hashes in constant time, and runs the same work for unknown emails, so response time doesn't reveal which emails exist.
- The database stores only `sha256(token)`, so a copy of the database can't be used to log in.
- Every route except sign-up, login, `/health`, `/sample.csv` and the demo page requires the token. With no token or a bad token you get **401**, a `WWW-Authenticate: Bearer` header and a code: `unauthenticated`, `invalid_token` or `token_expired`.
- **No reading another person's rows:** every query includes `user_id = <you>`. Asking for someone else's import returns `404`, the same as an import that doesn't exist, so ids can't be probed. Tests check this for every import route and for `/wrapped`.
- Sign-up and login allow 30 attempts per minute per IP. After that you get `429 rate_limited` with `Retry-After`.

## Endpoints

Every error has the same shape: `{"error": {"code": "…", "message": "…", …details}}`. The `code` is stable, so programs can branch on it. The `message` tells a person what to do next, and the details carry what they need to fix it, such as `field`, `missing`, `found`, `limit`, `retryAfterSeconds` or `importId`.

| Method | Path | Success | Errors |
|---|---|---|---|
| `POST` | `/auth/signup` | **201** `{user, token, expiresAt}` | `400 validation_failed` (with `field`) · `409 email_taken` · `429 rate_limited` |
| `POST` | `/auth/login` | **200** `{user, token, expiresAt}` | `401 invalid_credentials` · `429 rate_limited` |
| `POST` | `/auth/logout` | **204** | `401` |
| `GET` | `/me` | **200** user and transaction count | `401` |
| `POST` | `/imports?filename=x.csv` with a `text/csv` body and optional `Idempotency-Key` | **202** the queued import, with `Location` (a replay adds `Idempotent-Replayed: true`) | `400 csv_missing_columns` (with `missing`, `expected`, `found`) · `400 csv_empty` · `413 too_many_rows` / `payload_too_large` (2 MB) · `415 unsupported_media_type` · `422 idempotency_key_reused` |
| `GET` | `/imports` | **200** your last 50 imports | `401` |
| `GET` | `/imports/:id` | **200** progress, counts, first 20 row errors, event log | `401` · `404 not_found` |
| `POST` | `/imports/:id/rerun` | **202** queued again | `409 import_in_progress` |
| `POST` | `/imports/:id/crash-worker` | **202** the worker that was killed (demo feature) | `409 import_not_running` |
| `GET` | `/wrapped` | **200** `{years, fingerprint, summaries}` | `401` |
| `GET` | `/wrapped/:year` | **200** one year | `404 no_data_for_year` (with `availableYears`) |
| `GET` | `/sample.csv`, `/health` | **200** | |

Bad rows don't fail the import. They are counted as `invalidRows` and listed with a reason. For example, the sample file contains four on purpose: `row 41: date "2025-02-30" is not a valid YYYY-MM-DD or MM/DD/YYYY date`, a refund, `amount "TBA"`, and an empty merchant.

## CSV format

```
date,merchant,amount,category
2025-01-03,Starbucks BGC,185.00,
2025-01-03,Grab,236.50,
```

- Column names are matched loosely. `description`, `payee` and `details` all work for `merchant`, and `posting date` works for `date`.
- Dates can be `YYYY-MM-DD` or `MM/DD/YYYY`. Amounts can include `₱` and thousands separators.
- An empty `category` is filled in from the merchant name, for example Grab → Transport, Meralco → Bills & utilities, GrabFood → Food delivery.
- The limits are 2 MB and 20,000 rows per file.

## No secrets in the repository

There is nothing secret to commit: no API keys, and no session-signing secret, because tokens are random and looked up by hash. `.env` files and `*.db` files are in `.gitignore`. `test/secrets.test.js` fails if a `.env` file or anything resembling a private key, cloud key or hard-coded credential appears in the project.

## Deploying (Render, free tier)

| Setting | Value |
|---|---|
| Root Directory | `SpendingWrapped` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

The web process and the worker run in the same Render service. The worker is a child process that the web process supervises.

Free-tier limits to know about:

- The service sleeps after 15 minutes without traffic.
- The disk is wiped on every restart or redeploy, so accounts and imports reset.

For a real deployment, move `DB_FILE` to a persistent disk, or swap SQLite for Postgres. The same lease, checkpoint and unique-key design works unchanged with `SELECT … FOR UPDATE SKIP LOCKED`.

## Project layout

```
src/
  server.js       starts the web server and the worker supervisor
  supervisor.js   forks the worker, records its death on its jobs, restarts it
  worker.js       the background process: claim → run → repeat
  jobs.js         lease claiming, checkpointed batches, retries, give-up
  app.js          HTTP routes and error responses
  auth.js         scrypt passwords, random tokens stored as hashes
  csv.js          CSV parsing, header aliases, row validation, row keys
  categorize.js   merchant → category rules
  summary.js      builds the Wrapped and its fingerprint
  sample.js       deterministic 1,191-row sample year
  db.js           schema and transactions
public/index.html live demo page
test/             auth, imports (run twice, idempotency, isolation), crash (real SIGKILL), secrets
```
