// Runs the real ffmpeg pipeline on a generated clip whose frame k has brightness 8k, so a decoded
// pixel tells us exactly which frame came back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { MediaError, extractFrame, extractSequence, probe, renderSheets } from '../server/media.ts';
import { planSamples, seekTime } from '../shared/frames.ts';

const FFMPEG = ffmpegPath ?? 'ffmpeg';
const dir = await mkdtemp(join(tmpdir(), 'stillroom-test-'));
const clip = join(dir, 'ramp.mp4');

// 30 frames at 10 fps, lossless H.264 with B-frames (so decode order differs from display order)
spawnSync(FFMPEG, [
  '-v', 'error', '-f', 'lavfi', '-i', "color=c=black:s=64x48:r=10:d=3,format=gray,geq=lum='N*8'",
  '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'yuv420p', '-bf', '2', clip,
]);

// Brightness of the centre pixel of an encoded image
function brightness(image: Buffer): number {
  const out = spawnSync(FFMPEG, ['-v', 'error', '-i', 'pipe:0', '-vf', 'crop=1:1:iw/2:ih/2', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], { input: image });
  return out.stdout[0] ?? -1;
}

test.after(() => rm(dir, { recursive: true, force: true }));

test('probe reads the metadata', async () => {
  const info = await probe(clip, 'ramp.mp4');
  assert.equal(info.container, 'mp4');
  assert.equal(info.width, 64);
  assert.equal(info.height, 48);
  assert.equal(info.fps, 10);
  assert.equal(info.estimatedFrames, 30);
  assert.ok(Math.abs(info.durationS - 3) < 0.2);
});

test('probe refuses a file that is not a video', async () => {
  const notes = join(dir, 'notes.mp4');
  await writeFile(notes, 'definitely not a video');
  await assert.rejects(probe(notes, 'notes.mp4'), (error) => error instanceof MediaError && error.code === 'unreadable');
});

let times: number[] = [];

test('contact sheets and frame timestamps come from one pass', async () => {
  const out = join(dir, 'sheets');
  await import('node:fs/promises').then((fs) => fs.mkdir(out));
  const plan = planSamples(30, 64, 48);
  const seen: number[] = [];
  const result = await renderSheets(clip, out, plan, (n) => seen.push(n));
  times = result.times;
  assert.equal(times.length, 30);
  assert.deepEqual(result.sheets, ['sheet-000.jpg']);
  assert.equal(seen.at(-1), 29);
  for (let i = 1; i < times.length; i++) assert.ok(times[i]! > times[i - 1]!, 'timestamps increase');
});

test('every frame extracts exactly, by number', async () => {
  for (const frame of [0, 1, 7, 15, 29]) {
    const image = await extractFrame(clip, seekTime(times, frame), 'png', null);
    assert.ok(Math.abs(brightness(image) - frame * 8) <= 1, `frame ${frame}`);
  }
  const webp = await extractFrame(clip, seekTime(times, 12), 'webp', 32, 90);
  assert.equal(webp.subarray(8, 12).toString(), 'WEBP');
});

test('a sequence export starts on the right frame and keeps the step', async () => {
  const out = join(dir, 'seq');
  await import('node:fs/promises').then((fs) => fs.mkdir(out));
  const files = await extractSequence(clip, seekTime(times, 5), 3, 4, 'png', null, 90, out);
  assert.equal(files.length, 4);
  assert.deepEqual((await readdir(out)).sort(), ['f_00000.png', 'f_00001.png', 'f_00002.png', 'f_00003.png']);
  const { readFile } = await import('node:fs/promises');
  const levels = await Promise.all(files.map(async (file) => brightness(await readFile(file))));
  levels.forEach((level, i) => assert.ok(Math.abs(level - (5 + i * 3) * 8) <= 1, `sequence frame ${i}`));
});
