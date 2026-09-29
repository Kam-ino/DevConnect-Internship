import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createStore } from './store.js';
import { validateCreateBody, validateId, validateUserId } from './validate.js';

export const BODY_LIMIT = '16kb';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sendError(res, status, message, field) {
  res.status(status).json(field ? { error: message, field } : { error: message });
}

export function createApp({ db }) {
  const store = createStore(db);
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json({ limit: BODY_LIMIT }));

  app.use(express.static(path.join(PROJECT_ROOT, 'public'), { index: 'index.html' }));
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/README.md', (req, res) => {
    res.type('text/markdown; charset=utf-8').sendFile(path.join(PROJECT_ROOT, 'README.md'));
  });

  const bookmarks = express.Router();

  bookmarks.use((req, res, next) => {
    const result = validateUserId(req.get('X-User-Id'));
    if (result.error) return sendError(res, result.status, result.error.message, result.error.field);
    req.userId = result.value;
    next();
  });

  bookmarks.param('id', (req, res, next, raw) => {
    const result = validateId(raw);
    if (result.error) return sendError(res, 400, result.error.message, result.error.field);
    req.bookmarkId = result.value;
    next();
  });

  bookmarks.post('/', (req, res) => {
    const result = validateCreateBody(req.body);
    if (result.error) return sendError(res, 400, result.error.message, result.error.field);

    const { bookmark, created } = store.create({ userId: req.userId, ...result.value });
    res
      .status(created ? 201 : 200)
      .location(`/bookmarks/${bookmark.id}`)
      .json(bookmark);
  });

  bookmarks.get('/', (req, res) => {
    res.status(200).json({ bookmarks: store.list(req.userId) });
  });

  bookmarks.get('/:id', (req, res) => {
    const bookmark = store.get(req.userId, req.bookmarkId);
    if (!bookmark) return sendError(res, 404, 'bookmark not found', 'id');
    res.status(200).json(bookmark);
  });

  bookmarks.delete('/:id', (req, res) => {
    if (!store.delete(req.userId, req.bookmarkId)) return sendError(res, 404, 'bookmark not found', 'id');
    res.status(204).end();
  });

  app.use('/bookmarks', bookmarks);

  app.use((req, res) => sendError(res, 404, `no route for ${req.method} ${req.path}`));

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
