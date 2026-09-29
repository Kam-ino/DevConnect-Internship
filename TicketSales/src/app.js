import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createStore } from './store.js';
import { parseId, validateReservationBody } from './validate.js';

export const BODY_LIMIT = '16kb';
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SQLITE_BUSY = 5;

function sendError(res, status, message, field) {
  res.status(status).json(field ? { error: message, field } : { error: message });
}

function idParam(field, key) {
  return (req, res, next, raw) => {
    const result = parseId(raw, field);
    if (result.error) return sendError(res, 400, result.error.message, result.error.field);
    req[key] = result.value;
    next();
  };
}

export function createApp({ db }) {
  const store = createStore(db);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Served-By', String(process.pid));
    next();
  });
  app.use(express.json({ limit: BODY_LIMIT }));

  app.use(express.static(path.join(PROJECT_ROOT, 'public'), { index: 'index.html' }));
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok', pid: process.pid }));
  app.get('/README.md', (req, res) => {
    res.type('text/markdown; charset=utf-8').sendFile(path.join(PROJECT_ROOT, 'README.md'));
  });

  app.param('eventId', idParam('eventId', 'eventId'));
  app.param('seatId', idParam('seatId', 'seatId'));
  app.param('orderId', idParam('orderId', 'orderId'));

  app.get('/stats', (req, res) => {
    res.status(200).json(store.stats());
  });

  app.get('/events', (req, res) => {
    res.status(200).json({ events: store.listEvents() });
  });

  app.get('/events/:eventId', (req, res) => {
    const event = store.getEvent(req.eventId);
    if (!event) return sendError(res, 404, 'event not found', 'eventId');
    res.status(200).json(event);
  });

  app.get('/events/:eventId/seats/free', (req, res) => {
    const started = performance.now();
    const event = store.getEvent(req.eventId);
    if (!event) return sendError(res, 404, 'event not found', 'eventId');
    const seats = store.freeSeats(req.eventId);
    res.set('Server-Timing', `db;dur=${(performance.now() - started).toFixed(2)}`);
    res.status(200).json({ eventId: event.id, freeCount: seats.length, seats });
  });

  app.get('/events/:eventId/seats/:seatId', (req, res) => {
    const seat = store.getSeat(req.eventId, req.seatId);
    if (!seat) return sendError(res, 404, 'seat not found for this event', 'seatId');
    res.status(200).json(seat);
  });

  app.post('/events/:eventId/seats/:seatId/reservations', (req, res) => {
    const body = validateReservationBody(req.body);
    if (body.error) return sendError(res, 400, body.error.message, body.error.field);

    const result = store.reserve(req.eventId, req.seatId, body.value.customer);
    if (result.error === 'seat_not_found') return sendError(res, 404, 'seat not found for this event', 'seatId');
    if (result.error === 'seat_taken') return sendError(res, 409, 'seat is already reserved', 'seatId');

    res.status(201).location(`/orders/${result.order.id}`).json(result.order);
  });

  app.get('/orders/:orderId', (req, res) => {
    const order = store.getOrder(req.orderId);
    if (!order) return sendError(res, 404, 'order not found', 'orderId');
    res.status(200).json(order);
  });

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
    if (err.errcode === SQLITE_BUSY || (err.errcode & 0xff) === SQLITE_BUSY) {
      res.set('Retry-After', '1');
      return sendError(res, 503, 'database is busy, try again');
    }
    if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
      return sendError(res, err.status, err.expose ? err.message : 'bad request');
    }
    console.error(err);
    return sendError(res, 500, 'internal server error');
  });

  return app;
}
