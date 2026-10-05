import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSequence, planSamples, seekTime, sequenceLength, sequenceName, slug, tileOf, timecode } from '../shared/frames.ts';

test('contact sheet keeps every frame when it fits, otherwise samples evenly', () => {
  const short = planSamples(240, 1920, 1080);
  assert.equal(short.step, 1);
  assert.equal(short.count, 240);
  assert.equal(short.sheets, 3);
  assert.equal(short.tileHeight, 90);

  const long = planSamples(9000, 1920, 1080); // 5 minutes at 30 fps
  assert.equal(long.step, 15);
  assert.equal(long.count, 600);
  assert.equal(long.sheets, 6);

  const portrait = planSamples(100, 1080, 1920);
  assert.equal(portrait.tileHeight, 284);
});

test('tiles are addressed by sheet, column and row', () => {
  assert.deepEqual(tileOf(0, 10, 10), { sheet: 0, col: 0, row: 0 });
  assert.deepEqual(tileOf(57, 10, 10), { sheet: 0, col: 7, row: 5 });
  assert.deepEqual(tileOf(100, 10, 10), { sheet: 1, col: 0, row: 0 });
});

test('the seek point sits between a frame and the one before it', () => {
  const times = [0, 0.04, 0.08, 0.12];
  assert.equal(seekTime(times, 0), 0);
  assert.ok(Math.abs(seekTime(times, 2) - 0.06) < 1e-9);
  // variable frame rate: the gap varies, the midpoint still separates the two frames
  assert.ok(Math.abs(seekTime([0, 0.033, 0.1, 0.2], 3) - 0.15) < 1e-9);
});

test('timecode counts frames at the nominal rate', () => {
  assert.equal(timecode(0, 24), '00:00:00:00');
  assert.equal(timecode(36, 24), '00:00:01:12');
  assert.equal(timecode(3725 * 24 + 23, 24), '01:02:05:23');
  assert.equal(timecode(299, 29.97), '00:00:09:29');
});

test('sequence requests are checked with messages that say what to change', () => {
  const ok = checkSequence({ start: 10, end: 109, step: 1, width: 640, format: 'webp', quality: 80 }, 500, 1920);
  assert.equal(ok.ok, true);
  const tooMany = checkSequence({ start: 0, end: 999, step: 1 }, 1000, 1920);
  assert.equal(tooMany.ok, false);
  assert.match(!tooMany.ok ? tooMany.error : '', /at most 600/);
  const upscale = checkSequence({ start: 0, end: 10, width: 4000 }, 100, 1920);
  assert.match(!upscale.ok ? upscale.error : '', /never upscales/);
  const backwards = checkSequence({ start: 20, end: 10 }, 100, 1920);
  assert.match(!backwards.ok ? backwards.error : '', /before the start/);
  const outside = checkSequence({ start: 0, end: 100 }, 100, 1920);
  assert.match(!outside.ok ? outside.error : '', /from 0 to 99/);
  assert.equal(checkSequence({ start: 0, end: 10, format: 'gif' }, 100, 1920).ok, false);
  assert.equal(sequenceLength(0, 9, 3), 4);
});

test('export file names are zero-padded and safe', () => {
  assert.equal(sequenceName('gallop', 7, 'webp'), 'gallop_0007.webp');
  assert.equal(slug('  My Clip (final) v2.MOV '), 'my-clip-final-v2mov');
  assert.equal(slug('***'), 'frames');
});
