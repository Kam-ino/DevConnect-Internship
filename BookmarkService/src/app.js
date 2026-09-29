import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createStore } from './store.js';
import { validateCreateBody, validateId, validateUserId } from './validate.js';

export const BODY_LIMIT = '16kb';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Send the one error shape every non-2xx response uses: { error, field? }. */
function sendError(res, status, message, field) {
  res.status(status).json(field ? { error: message, field } : { error: message });
}

/**
 * Build the Express app. The database is passed in so tests can use an
 * in-memory one and the real server can use a file.
 */
export function createApp({ db }) {
  const store = createStore(db);
  const app = express();
  app.disable('x-powered-by');

  // 16kb is plenty for a bookmark but far more than the 2 KB URL the brief
  // throws at us, so that case reaches our validator and gets a 400 naming
  // `url`. Anything bigger is stopped here with a 413.
  app.use(express.json({ limit: BODY_LIMIT }));

  // ---- Demo page and housekeeping (not part of the bookmarks API) ----
  // GET /            -> public/index.html, a page that runs every reviewer check live
  // GET /health      -> 200, used by the hosting platform to know the app is up
  // GET /README.md   -> the README, so the demo page can show the repeat rules
  app.use(express.static(path.join(PROJECT_ROOT, 'public'), { index: 'index.html' }));
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/README.md', (req, res) => {
    res.type('text/markdown; charset=utf-8').sendFile(path.join(PROJECT_ROOT, 'README.md'));
  });

  const bookmarks = express.Router();

  // Identify the caller. Every route below is scoped to this user.
  bookmarks.use((req, res, next) => {
    const result = validateUserId(req.get('X-User-Id'));
    if (result.error) return sendError(res, result.status, result.error.message, result.error.field);
    req.userId = result.value;
    next();
  });

  // Validate :id once for every route that has it.
  bookmarks.param('id', (req, res, next, raw) => {
    const result = validateId(raw);
    if (result.error) return sendError(res, 400, result.error.message, result.error.field);
    req.bookmarkId = result.value;
    next();
  });

  // POST /bookmarks  -> 201 created | 200 already existed | 400 bad input
  bookmarks.post('/', (req, res) => {
    const result = validateCreateBody(req.body);
    if (result.error) return sendError(res, 400, result.error.message, result.error.field);

    const { bookmark, created } = store.create({ userId: req.userId, ...result.value });
    res
      .status(created ? 201 : 200)
      .location(`/bookmarks/${bookmark.id}`)
      .json(bookmark);
  });

  // GET /bookmarks -> 200 with the caller's bookmarks, newest first
  bookmarks.get('/', (req, res) => {
    res.status(200).json({ bookmarks: store.list(req.userId) });
  });

  // GET /bookmarks/:id -> 200 | 404
  bookmarks.get('/:id', (req, res) => {
    const bookmark = store.get(req.userId, req.bookmarkId);
    if (!bookmark) return sendError(res, 404, 'bookmark not found', 'id');
    res.status(200).json(bookmark);
  });

  // DELETE /bookmarks/:id -> 204 | 404
  bookmarks.delete('/:id', (req, res) => {
    if (!store.delete(req.userId, req.bookmarkId)) return sendError(res, 404, 'bookmark not found', 'id');
    res.status(204).end();
  });

  app.use('/bookmarks', bookmarks);

  // Unknown route or wrong method.
  app.use((req, res) => sendError(res, 404, `no route for ${req.method} ${req.path}`));

  // Errors thrown by middleware (mostly express.json) end up here. The job of
  // this handler is to make sure bad *input* is never reported as a 500.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    switch (err.type) {
      case 'entity.parse.failed':
        return sendError(res, 400, 'request body is not valid JSON', 'body');
      case 'entity.too.large':
        return sendError(res, 413, `request body must be at most ${BODY_LIMIT}`, 'body');
      case 'encoding.unsupported':
      case 'charset.unsupported':
        return sendError(res, 415, 'request body must be UTF-8 JSON', 'body');
      default:
        break;
    }
    if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
      return sendError(res, err.status, err.expose ? err.message : 'bad request');
    }
    console.error(err);
    return sendError(res, 500, 'internal server error');
  });

  return app;
}
