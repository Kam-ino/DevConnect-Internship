// Processing and the local file cache. A video's source and frame timestamps live in Supabase
// Storage; the server keeps recent ones on local disk so stepping through frames stays fast.
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderSheets, MediaError } from './media.ts';
import { HttpError, dbError } from './supabase.ts';
import type { VideoRow } from '../shared/types.ts';

export type { VideoRow };

export const BUCKET = 'media';
export const CACHE_DIR = join(tmpdir(), 'stillroom-cache');
const MAX_CACHED_VIDEOS = 4; // ponytail: evicts the oldest; a disk-size budget if videos get bigger


export const folderOf = (video: Pick<VideoRow, 'user_id' | 'id'>) => `${video.user_id}/${video.id}`;
export const sourcePath = (video: Pick<VideoRow, 'user_id' | 'id' | 'container'>) => `${folderOf(video)}/source.${video.container}`;

// ---- Cache --------------------------------------------------------------------------------------

const cached = new Map<string, Promise<string>>(); // video id -> local file, insertion order = age

function remember(key: string, file: Promise<string>) {
  cached.set(key, file);
  file.catch(() => cached.delete(key));
  while (cached.size > MAX_CACHED_VIDEOS * 2) {
    const oldest = cached.keys().next().value as string;
    const stale = cached.get(oldest);
    cached.delete(oldest);
    void stale?.then((path) => rm(path, { force: true })).catch(() => {});
  }
}

// Put a freshly uploaded file straight into the cache.
export async function adoptSource(video: VideoRow, file: string) {
  await mkdir(CACHE_DIR, { recursive: true });
  const target = join(CACHE_DIR, `${video.id}.${video.container}`);
  await rename(file, target);
  remember(`source:${video.id}`, Promise.resolve(target));
}

async function download(sb: SupabaseClient, path: string, target: string): Promise<string> {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new HttpError(502, 'storage_unreachable', 'Stillroom couldn’t fetch this video from storage. Try again in a moment.');
  await mkdir(CACHE_DIR, { recursive: true });
  await pipeline(Readable.fromWeb(data.stream() as import('node:stream/web').ReadableStream), createWriteStream(target));
  return target;
}

export function getSource(sb: SupabaseClient, video: VideoRow): Promise<string> {
  const key = `source:${video.id}`;
  let file = cached.get(key);
  if (!file) {
    file = download(sb, sourcePath(video), join(CACHE_DIR, `${video.id}.${video.container}`));
    remember(key, file);
  }
  return file;
}

// Every frame's timestamp, in frame order (written by processing as frames.json).
const timesCache = new Map<string, Promise<number[]>>();
export function getTimes(sb: SupabaseClient, video: VideoRow): Promise<number[]> {
  let times = timesCache.get(video.id);
  if (!times) {
    times = getSource(sb, video).then(async () => {
      const file = join(CACHE_DIR, `${video.id}.frames.json`);
      const local = await readFile(file).catch(() => null);
      if (local) return JSON.parse(local.toString()) as number[];
      await download(sb, `${folderOf(video)}/frames.json`, file);
      return JSON.parse((await readFile(file)).toString()) as number[];
    });
    times.catch(() => timesCache.delete(video.id));
    timesCache.set(video.id, times);
    if (timesCache.size > MAX_CACHED_VIDEOS * 2) timesCache.delete(timesCache.keys().next().value as string);
  }
  return times;
}

export function forget(videoId: string) {
  const key = `source:${videoId}`;
  void cached.get(key)?.then((path) => rm(path, { force: true })).catch(() => {});
  cached.delete(key);
  timesCache.delete(videoId);
  void rm(join(CACHE_DIR, `${videoId}.frames.json`), { force: true });
}

// ---- Limited concurrency ------------------------------------------------------------------------

// ffmpeg is CPU-heavy, so at most `size` runs at once; the rest wait their turn.
export function limiter(size: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function <T>(task: () => Promise<T>): Promise<T> {
    if (active >= size) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

export const extractSlot = limiter(2);
const processSlot = limiter(1);

// ---- Processing ---------------------------------------------------------------------------------

const running = new Set<string>();
export const isRunning = (videoId: string) => running.has(videoId);

// Render the contact sheets and timestamps in the background, reporting progress on the row.
// Runs with the uploader's token; a failure is written to the row so the app can say what happened.
export function startProcessing(sb: SupabaseClient, video: VideoRow) {
  if (running.has(video.id)) return;
  running.add(video.id);
  void processSlot(() => processVideo(sb, video)).finally(() => running.delete(video.id));
}

async function processVideo(sb: SupabaseClient, video: VideoRow) {
  const work = await mkdtemp(join(tmpdir(), 'stillroom-sheets-'));
  const update = (fields: Partial<VideoRow>) => sb.from('videos').update(fields).eq('id', video.id);
  try {
    const source = await getSource(sb, video);
    let lastReport = 0;
    const { times, sheets } = await renderSheets(
      source,
      work,
      { step: video.sample_step, count: video.sample_count, tileWidth: video.tile_width, tileHeight: video.tile_height, cols: video.sheet_cols, rows: video.sheet_rows, sheets: 0 },
      (frame) => {
        if (Date.now() - lastReport < 1500) return;
        lastReport = Date.now();
        void update({ progress: Math.min(0.9, (frame / video.frame_count) * 0.9) });
      },
    );

    for (const sheet of sheets) {
      const { error } = await sb.storage.from(BUCKET).upload(`${folderOf(video)}/${sheet}`, await readFile(join(work, sheet)), { contentType: 'image/jpeg', upsert: true });
      if (error) throw new HttpError(502, 'storage_error', `Couldn’t save the contact sheets to storage (${error.message}).`);
    }
    const timestamps = JSON.stringify(times.map((t) => Math.round(t * 1e6) / 1e6));
    const { error: timesError } = await sb.storage.from(BUCKET).upload(`${folderOf(video)}/frames.json`, timestamps, { contentType: 'application/json', upsert: true });
    if (timesError) throw new HttpError(502, 'storage_error', `Couldn’t save the frame timestamps to storage (${timesError.message}).`);
    timesCache.delete(video.id);

    const { error } = await update({
      status: 'ready', progress: 1, error: null, frame_count: times.length,
      sample_count: Math.ceil(times.length / video.sample_step), sheet_count: sheets.length,
    });
    if (error) throw dbError(error, 'mark the video as ready');
  } catch (failure) {
    const message = failure instanceof MediaError || failure instanceof HttpError
      ? failure.message
      : 'Processing stopped unexpectedly. Retry, and if it fails again, re-export the video and upload it again.';
    if (!(failure instanceof MediaError)) console.error(`processing ${video.id} failed:`, failure);
    await update({ status: 'failed', progress: 0, error: message.slice(0, 500) });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
