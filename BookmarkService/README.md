# Bookmark Service

A small HTTP service for saving bookmarks. A caller can create a bookmark, list their own, fetch one by id, and delete one.

The point of the exercise is the unhappy path: every malformed input comes back as a `400` that names the offending field, nothing malformed is ever saved, no input can produce a `500`, and sending the same create request twice leaves exactly one row.

**Stack:** Node.js 22.13+ · Express 5 · SQLite via the built-in `node:sqlite` module (no native dependencies) · tests with the built-in `node:test` runner.

## Running it

```bash
npm install
npm start          # http://localhost:3000, data in ./bookmarks.db
npm test           # 37 tests, uses an in-memory database
```

Environment variables: `PORT` (default `3000`), `DB_FILE` (default `bookmarks.db`, use `:memory:` for a throwaway run).

## Who is the caller?

"List their own" needs a notion of *who* is calling. Real auth is out of scope, so every request carries an `X-User-Id` header (letters, digits and `. _ : @ -`, max 128 characters). Every query is filtered by that id, so one user can never see, fetch or delete another user's bookmarks. Asking for someone else's bookmark returns `404`, not `403`, so the API does not reveal that the id exists.

## Endpoints

All responses are JSON. All routes require the `X-User-Id` header.

| Method | Path | Success | Other documented responses |
|---|---|---|---|
| `POST` | `/bookmarks` | **201 Created** – new bookmark, with a `Location` header<br>**200 OK** – this URL was already bookmarked; returns the existing one | `400` bad body · `401` no user · `413` body over 16 KB |
| `GET` | `/bookmarks` | **200 OK** – `{ "bookmarks": [...] }`, newest first | `400` / `401` bad or missing user |
| `GET` | `/bookmarks/:id` | **200 OK** – the bookmark | `400` id is not a positive integer · `404` not found (or not yours) |
| `DELETE` | `/bookmarks/:id` | **204 No Content** | `400` bad id · `404` not found (or not yours) |
| any | anything else | – | `404` no such route |

### Request body for `POST /bookmarks`

```json
{ "url": "https://example.com/article", "title": "Optional title" }
```

| Field | Rules |
|---|---|
| `url` | **Required.** A string; surrounding spaces are trimmed; must not be empty; at most **2000 characters**; no spaces, tabs, newlines or control characters inside; must be an absolute `http` or `https` URL. |
| `title` | Optional. A string of at most 200 characters, or `null`. An empty title is stored as `null`. |

Unknown fields are ignored.

### Bookmark shape

```json
{ "id": 1, "url": "https://example.com/article", "title": "Optional title", "createdAt": "2026-09-29T03:12:45.120Z" }
```

### Error shape

Every non-2xx response has the same shape. `field` names the input that was wrong: `url`, `title`, `id`, `body` or `X-User-Id`.

```json
{ "error": "url must be a string, got a number", "field": "url" }
```

The four cases from the brief:

| Sent | Response |
|---|---|
| `{"url": ""}` | `400 {"error":"url must not be empty","field":"url"}` |
| `{"url": 12345}` | `400 {"error":"url must be a string, got a number","field":"url"}` |
| `{}` | `400 {"error":"url is required","field":"url"}` |
| a 2 KB URL | `400 {"error":"url must be at most 2000 characters, got 2048","field":"url"}` |

Why 2000 characters? It is the long-standing practical limit that works across browsers, servers and CDNs, and it comfortably fits real-world URLs. The body limit is 16 KB, deliberately much larger than a 2 KB URL, so an over-long URL reaches the validator and gets a `400` that names `url` instead of a generic "body too large".

## How repeats are recognised

**A repeat is: the same user saving a URL whose *normalised* form they have already saved.** The title plays no part.

### 1. What counts as "the same URL"

Before saving, the URL is normalised (`src/normalize-url.js`) and stored in a `normalized_url` column next to the URL exactly as the caller sent it. Only rewrites that cannot change which page the URL points to are applied (RFC 3986 §6.2.2 plus the WHATWG URL parser):

| Rewrite | Example |
|---|---|
| Lower-case the scheme and host | `HTTPS://Example.COM` → `https://example.com/` |
| Drop the default port | `https://example.com:443/a` → `https://example.com/a` |
| Empty path becomes `/` | `https://example.com` → `https://example.com/` |
| Resolve `.` and `..` segments | `/a/./b/../c` → `/a/c` |
| Upper-case percent-escapes | `%7e` → `%7E` |
| Remove a dangling `?` or `#` | `/page?` → `/page` |
| Trim surrounding whitespace | `"  https://x.com  "` → `https://x.com/` |

These are **deliberately not** treated as the same, even though they often are:

| Kept distinct | Why |
|---|---|
| `/a` vs `/a/` | Many servers route these differently. |
| `?x=1` vs no query, or `?a=1&b=2` vs `?b=2&a=1` | Query strings select content (search results, product variants, pages), and some servers care about order. |
| `#section` vs no fragment | Single-page apps route with fragments (`/#/inbox` vs `/#/settings`). |
| `http://` vs `https://` | Different scheme, can be a different site. |
| `www.example.com` vs `example.com` | Different hosts; not guaranteed to serve the same thing. |
| `/A` vs `/a` | Paths are case-sensitive. |
| Tracking parameters like `utm_source` | Stripping them means maintaining a guess-list, and some sites use similar names for real parameters. |

**The trade-off:** if normalisation is too aggressive, two *different* pages get merged and the user silently loses a bookmark, which they can't fix. If it is too cautious, the user sometimes ends up with two entries for the same page, which they can see and delete. So the rules only merge URLs that are provably the same.

Why not compare the raw string? Then `https://Example.com` and `https://example.com/` would be two rows, even though no browser or server treats them as different.

Why not hash the whole request body? Then changing the title would create a second bookmark for the same page, which isn't what a user means by "save this page".

### 2. Scoped per user

Uniqueness is on `(user_id, normalized_url)`. Alice and Bob can both bookmark the same page. Each of them can only have it once.

### 3. Enforced by the database, not by an `if`

```sql
UNIQUE (user_id, normalized_url)
...
INSERT ... ON CONFLICT (user_id, normalized_url) DO NOTHING RETURNING *
```

A "look it up, then insert if missing" check in JavaScript has a race: two identical requests arriving together can both see "not there yet" and both insert. The `UNIQUE` constraint makes a second row impossible, whatever the timing. The tests fire 20 identical creates at once and check that there is still exactly one row.

### 4. What a repeat returns

A repeat returns **`200 OK` with the existing bookmark** (same `id`, original title unchanged). A new bookmark returns `201 Created`.

This makes `POST /bookmarks` safe to retry. If a client's first request timed out, it can resend and get the same result instead of an error it has to special-case. The status code still tells the client whether anything was created. `409 Conflict` was considered and rejected: a repeat save isn't a mistake by the caller, so it shouldn't be reported as an error. Silently updating the title was also rejected, because then a retried old request could overwrite a newer edit.

## Never a 500

- All input checks are in `src/validate.js` and return `{ error }` instead of throwing.
- Invalid JSON, a body that isn't a JSON object, the wrong `Content-Type` or no body all return `400` with `field: "body"`. Bodies over 16 KB return `413`.
- The final error handler maps every known body-parser error to a `4xx`. Only a real server bug can reach its `500` branch.
- `test/bookmarks.test.js` includes a list of hostile bodies (bare `null`, numbers, arrays, `__proto__` keys, broken IPv6 hosts, NUL bytes, invalid UTF-8, truncated JSON, 50 KB of junk) and checks that none of them get a `5xx`.

## Project layout

```
src/
  server.js          starts the HTTP server
  app.js             Express app: routes, status codes, error handler
  validate.js        input validation (url, title, id, X-User-Id)
  normalize-url.js   the canonical form used to recognise repeats
  store.js           all SQL, always scoped by user_id
  db.js              schema, including the UNIQUE constraint
test/
  bookmarks.test.js  endpoints, bad inputs, no-500s, repeats, user isolation
  normalize-url.test.js
  helpers.js         starts the app on a random port with an in-memory DB
```

## Trying it by hand

```bash
# create -> 201
curl -i -X POST localhost:3000/bookmarks -H "X-User-Id: alice" -H "Content-Type: application/json" -d '{"url":"https://example.com","title":"Example"}'

# same again, different spelling -> 200, same id
curl -i -X POST localhost:3000/bookmarks -H "X-User-Id: alice" -H "Content-Type: application/json" -d '{"url":"HTTPS://EXAMPLE.COM:443/"}'

# bad input -> 400 naming the field
curl -i -X POST localhost:3000/bookmarks -H "X-User-Id: alice" -H "Content-Type: application/json" -d '{"url":12345}'

curl -i localhost:3000/bookmarks -H "X-User-Id: alice"
curl -i localhost:3000/bookmarks/1 -H "X-User-Id: alice"
curl -i -X DELETE localhost:3000/bookmarks/1 -H "X-User-Id: alice"
```

On Windows PowerShell, use `curl.exe` instead of `curl`, and escape the inner double quotes in the JSON as `\"`.
