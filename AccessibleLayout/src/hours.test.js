import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEEK, formatHours, statusAt } from './hours.js';

// Date strings without a time zone are read as local time.
const at = (when) => statusAt(new Date(when));

test('open during the day', () => {
  assert.deepEqual(at('2026-10-03T11:00'), { open: true, headline: 'Open now', detail: 'until 5 pm' });
});

test('before opening time', () => {
  assert.equal(at('2026-10-06T08:30').detail, 'opens today at 9 am');
});

test('Monday is closed all day', () => {
  assert.deepEqual(at('2026-10-05T12:00'), { open: false, headline: 'Closed now', detail: 'opens tomorrow at 9 am' });
});

test('after Sunday closing skips Monday', () => {
  assert.equal(at('2026-10-04T17:00').detail, 'opens Tuesday at 9 am');
});

test('one-off closure day', () => {
  assert.deepEqual(at('2026-10-31T11:00'), { open: false, headline: 'Closed today', detail: 'opens tomorrow at noon' });
});

test('the evening before a closure skips it', () => {
  assert.equal(at('2026-10-30T20:00').detail, 'opens Sunday at noon');
});

test('hours are written out for the slip', () => {
  assert.equal(formatHours(WEEK[0]), 'Noon to 4 pm');
  assert.equal(formatHours(WEEK[1]), 'Closed');
  assert.equal(formatHours(WEEK[4]), '9 am to 8 pm');
});
