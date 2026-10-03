import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, formatTime, inkFor, sessionsIn, slotAt, statusAt } from './schedule.js';

// Date strings without a time zone are read as local time.
const at = (when) => new Date(when);

test('counts down before the day', () => {
  assert.deepEqual(statusAt(at('2026-10-03T12:00')), { headline: '12 days to go', detail: 'doors open 8:30 am' });
  assert.equal(statusAt(at('2026-10-14T18:00')).headline, 'Tomorrow');
});

test('on the morning before doors open', () => {
  assert.deepEqual(statusAt(at('2026-10-15T07:45')), { headline: 'Today', detail: 'doors open at 8:30 am' });
});

test('during a talk and during lunch', () => {
  assert.deepEqual(statusAt(at('2026-10-15T10:40')), { headline: 'On now', detail: 'until 11:05 am' });
  assert.equal(statusAt(at('2026-10-15T12:45')).detail, 'until 1:30 pm');
});

test('after closing and on later days', () => {
  assert.equal(statusAt(at('2026-10-15T16:30')).headline, "That's a wrap");
  assert.equal(statusAt(at('2026-11-02T09:00')).detail, 'see you next year');
});

test('ink dries once a session is over', () => {
  assert.equal(inkFor('10:15', '11:05', at('2026-10-15T10:40')), 'fresh');
  assert.equal(inkFor('10:15', '11:05', at('2026-10-15T11:05')), 'dry');
  assert.equal(inkFor('10:15', '11:05', at('2026-10-15T09:00')), 'wet');
  assert.equal(inkFor('10:15', '11:05', at('2026-10-03T12:00')), 'wet');
  assert.equal(inkFor('10:15', '11:05', at('2026-10-20T12:00')), 'dry');
});

test('knows which talks are on now, and where', () => {
  const now = slotAt(at('2026-10-15T10:40'));
  assert.deepEqual(sessionsIn(SLOTS[now]).map((s) => `${s.title}, ${s.room}`), [
    'Semantic HTML is a feature, Hall A',
    'Forms that explain their errors, Hall B',
  ]);
  assert.equal(slotAt(at('2026-10-15T08:00')), -1);
  assert.equal(slotAt(at('2026-10-15T16:30')), -1);
  assert.equal(slotAt(at('2026-10-03T10:40')), -1);
});

test('times are written out', () => {
  assert.equal(formatTime('08:30'), '8:30 am');
  assert.equal(formatTime('12:20'), '12:20 pm');
  assert.equal(formatTime('16:30'), '4:30 pm');
  assert.equal(formatTime('09:00'), '9 am');
});
