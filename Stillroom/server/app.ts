// The HTTP API. Express 5 forwards rejected promises to the error handler at the bottom, so routes
// throw HttpError / MediaError and every failure reaches the client as { error: { code, message } }.
import express, { type NextFunction, type Request, type Response } from 'express';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LIMITS, checkSequence, formatBytes, planSamples, seekTime, sequenceLength, sequenceName, slug, type ImageFormat,
} from '../shared/frames.ts';
import { MediaError, extractFrame, extractSequence, probe } from './media.ts';
import { BUCKET, adoptSource, extractSlot, folderOf, forget, getSource, getTimes, isRunning, sourcePath, startProcessing, type VideoRow } from './jobs.ts';
import { HttpError, clientFor, config, configured, dbError, verifyToken } from './supabase.ts';
import { ZipWriter } from './zip.ts';

// Set by requireUser: who is asking, and a Supabase client acting as them.
const authOf = (res: Response) => res.locals as { userId: string; sb: SupabaseClient };

export const api = express.Router();
api.use(express.json({ limit: '16kb' }));

// Public settings the app needs before anyone signs in.
api.get('/config', (_req, res) => {
  if (!configured()) {
    throw new HttpError(503, 'not_configured', 'The server isn’t connected to Supabase yet. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env, then restart the server.');
  }
  res.json({ supabaseUrl: config.url, supabaseAnonKey: config.anonKey, limits: LIMITS });
});

async function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!configured()) throw new HttpError(503, 'not_configured', 'The server isn’t connected to Supabase yet.');
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
  if (!token) throw new HttpError(401, 'signed_out', 'Sign in to continue.');
  res.locals.userId = await verifyToken(token);
  res.locals.sb = clientFor(token);
  next();
}
api.use('/videos', requireUser);

// Video rows, briefly cached per user so stepping through frames doesn't re-read the row each time.
const rows = new Map<string, { row: VideoRow; until: number }>();
async function loadVideo(req: Request, res: Response, { ready = false } = {}): Promise<VideoRow> {
  const { sb, userId } = authOf(res);
  const id = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'not_found', 'There’s no video at this address.');
  const key = `${userId}:${id}`;
  const hit = rows.get(key);
  let row = hit && hit.until > Date.now() && (!ready || hit.row.status === 'ready') ? hit.row : null;
  if (!row) {
    const { data, error } = await sb.from('videos').select('*').eq('id', id).maybeSingle();
    if (error) throw dbError(error, 'load the video');
    if (!data) throw new HttpError(404, 'not_found', 'This video doesn’t exist, or it belongs to another account.');
    row = data as VideoRow;
    if (rows.size > 500) rows.clear();
    rows.set(key, { row, until: Date.now() + 30_000 });
  }
  if (ready && row.status !== 'ready') {
    throw new HttpError(409, 'not_ready', row.status === 'failed' ? 'This video failed to process. Retry it from the library.' : 'This video is still processing.');
  }
  return row;
}

// ---- Upload ---------------------------------------------------------------------------------------

// The body is the raw file (no multipart), streamed to disk with a byte counter so an oversized
// upload is cut off at 50 MB even if the client lied about its size.
api.post('/videos', async (req, res) => {
  const { sb, userId } = authOf(res);
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > LIMITS.maxBytes) throw tooLarge(declared);
  const fileName = decodeURIComponent(String(req.headers['x-file-name'] ?? 'video')).slice(0, 255);

  const dir = await mkdtemp(join(tmpdir(), 'stillroom-upload-'));
  const file = join(dir, 'upload');
  try {
    let received = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, done) {
        received += chunk.length;
        done(received > LIMITS.maxBytes ? tooLarge(received) : null, chunk);
      },
    });
    try {
      await pipeline(req, counter, createWriteStream(file));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, 'upload_interrupted', 'The upload was interrupted before the whole file arrived. Check your connection and upload it again.');
    }
    if (!received) throw new HttpError(400, 'empty_upload', 'The uploaded file is empty.');

    const info = await probe(file, fileName);
    if (info.durationS > LIMITS.maxSeconds + 0.5) {
      throw new HttpError(422, 'too_long', `This video runs ${Math.round(info.durationS)} seconds. Stillroom takes up to 5 minutes; trim it and upload again.`);
    }
    const plan = planSamples(info.estimatedFrames, info.width, info.height);
    const title = basename(fileName).replace(/\.[^.]+$/, '').trim().slice(0, 200) || 'Untitled video';

    const { data, error } = await sb.from('videos').insert({
      user_id: userId, title, container: info.container, size_bytes: received, duration_s: info.durationS, fps: info.fps,
      width: info.width, height: info.height, frame_count: info.estimatedFrames, sample_step: plan.step, sample_count: plan.count,
      tile_width: plan.tileWidth, tile_height: plan.tileHeight, sheet_cols: plan.cols, sheet_rows: plan.rows,
    }).select('*').single();
    if (error || !data) throw dbError(error, 'save the video');
    const video = data as VideoRow;

    const { error: storageError } = await sb.storage.from(BUCKET).upload(sourcePath(video), await readFile(file), { contentType: info.mimeType, upsert: true });
    if (storageError) {
      await sb.from('videos').delete().eq('id', video.id);
      throw new HttpError(502, 'storage_error', `Supabase Storage didn’t accept the video (${storageError.message}). Nothing was saved; try again.`);
    }
    await adoptSource(video, file);
    startProcessing(sb, video);
    res.status(201).json({ video });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function tooLarge(bytes: number) {
  return new HttpError(413, 'too_large', `This file is ${formatBytes(bytes)}. Stillroom takes videos up to 50 MB; compress or trim it and upload again.`);
}

// Start processing again: after a failure, or when a job was interrupted (for example by a restart).
api.post('/videos/:id/retry', async (req, res) => {
  const { sb } = authOf(res);
  const video = await loadVideo(req, res);
  const stalled = video.status === 'processing' && !isRunning(video.id) && Date.now() - Date.parse(video.updated_at) > 60_000;
  if (video.status === 'ready' || (video.status === 'processing' && !stalled)) {
    throw new HttpError(409, 'not_retryable', video.status === 'ready' ? 'This video is already processed.' : 'This video is still processing.');
  }
  const { data, error } = await sb.from('videos').update({ status: 'processing', progress: 0, error: null }).eq('id', video.id).select('*').single();
  if (error || !data) throw dbError(error, 'restart processing');
  rows.delete(`${video.user_id}:${video.id}`);
  startProcessing(sb, data as VideoRow);
  res.status(202).json({ video: data });
});

api.delete('/videos/:id', async (req, res) => {
  const { sb } = authOf(res);
  const video = await loadVideo(req, res);
  const { data: files, error: listError } = await sb.storage.from(BUCKET).list(folderOf(video), { limit: 1000 });
  if (listError) throw new HttpError(502, 'storage_error', 'Couldn’t reach storage to delete this video’s files. Nothing was deleted; try again.');
  if (files?.length) {
    const { error } = await sb.storage.from(BUCKET).remove(files.map((f) => `${folderOf(video)}/${f.name}`));
    if (error) throw new HttpError(502, 'storage_error', 'Couldn’t delete this video’s files from storage. Nothing was deleted; try again.');
  }
  const { error } = await sb.from('videos').delete().eq('id', video.id);
  if (error) throw dbError(error, 'delete the video');
  rows.delete(`${video.user_id}:${video.id}`);
  forget(video.id);
  res.status(204).end();
});

// ---- Frames and exports -------------------------------------------------------------------------

const imageFormat = (value: unknown): ImageFormat => (value === 'png' ? 'png' : 'webp');
const mime = (format: ImageFormat) => (format === 'png' ? 'image/png' : 'image/webp');

function widthParam(value: unknown, video: VideoRow): number | null {
  if (value === undefined || value === '' || value === null) return null;
  const width = Number(value);
  if (!Number.isInteger(width) || width < 16) throw new HttpError(422, 'bad_width', 'Width must be a whole number of pixels, at least 16.');
  return width >= video.width ? null : width; // never upscale; the full size is the largest
}

function frameParam(value: unknown, video: VideoRow): number {
  const frame = Number(value);
  if (!Number.isInteger(frame) || frame < 0 || frame >= video.frame_count) {
    throw new HttpError(404, 'frame_out_of_range', `Frames in this video run from 0 to ${video.frame_count - 1}.`);
  }
  return frame;
}

const frameFile = (video: VideoRow, frame: number, format: ImageFormat) => `${slug(video.title)}_frame-${String(frame).padStart(6, '0')}.${format}`;

// One exact frame, full size unless ?width= asks for smaller. ?download=1 makes it a file download.
api.get('/videos/:id/frames/:frame', async (req, res) => {
  const { sb } = authOf(res);
  const video = await loadVideo(req, res, { ready: true });
  const frame = frameParam(req.params.frame, video);
  const format = imageFormat(req.query.format);
  const width = widthParam(req.query.width, video);
  const [source, times] = await Promise.all([getSource(sb, video), getTimes(sb, video)]);
  const image = await extractSlot(() => extractFrame(source, seekTime(times, frame), format, width, 90));
  res.setHeader('Cache-Control', 'private, max-age=86400');
  if (req.query.download) res.attachment(frameFile(video, frame, format));
  res.type(mime(format)).send(image);
});

// Every kept frame of a video, full size, as one ZIP.
api.post('/videos/:id/export/kept', async (req, res) => {
  const { sb } = authOf(res);
  const video = await loadVideo(req, res, { ready: true });
  const format = imageFormat(req.body?.format);
  const { data, error } = await sb.from('kept_frames').select('frame_index, label').eq('video_id', video.id).order('frame_index');
  if (error) throw dbError(error, 'load the kept frames');
  if (!data?.length) throw new HttpError(409, 'nothing_kept', 'Keep at least one frame first.');
  const [source, times] = await Promise.all([getSource(sb, video), getTimes(sb, video)]);

  res.attachment(`${slug(video.title)}_kept-frames.zip`).type('application/zip');
  const zip = new ZipWriter(res);
  for (const { frame_index } of data) {
    const image = await extractSlot(() => extractFrame(source, seekTime(times, frame_index), format, null, 92));
    await zip.add(frameFile(video, frame_index, format), image);
  }
  await zip.finish();
});

// A run of frames as a numbered image sequence with a manifest, for frame-by-frame web animation.
api.post('/videos/:id/export/sequence', async (req, res) => {
  const { sb } = authOf(res);
  const video = await loadVideo(req, res, { ready: true });
  const checked = checkSequence(req.body, video.frame_count, video.width);
  if (!checked.ok) throw new HttpError(422, 'bad_sequence', checked.error);
  const { start, end, step, format, quality } = checked.value;
  const width = checked.value.width && checked.value.width < video.width ? checked.value.width : null;
  const count = sequenceLength(start, end, step);
  const outWidth = width ?? video.width;
  const outHeight = width ? Math.round((video.height * width) / video.width / 2) * 2 : video.height;
  if (count * outWidth * outHeight > LIMITS.maxExportFrames * 1920 * 1080) {
    throw new HttpError(422, 'export_too_large', `${count} frames at ${outWidth}×${outHeight} is more than one export can hold. Lower the width or raise the step.`);
  }

  const [source, times] = await Promise.all([getSource(sb, video), getTimes(sb, video)]);
  const work = await mkdtemp(join(tmpdir(), 'stillroom-seq-'));
  try {
    const files = await extractSlot(() => extractSequence(source, seekTime(times, start), step, count, format, width, quality, work));
    if (!files.length) throw new MediaError('extract_failed', 'ffmpeg produced no frames for that range.');
    const base = slug(video.title);
    const manifest = {
      generator: 'Stillroom',
      source: video.title,
      format,
      width: outWidth,
      height: outHeight,
      fps: Math.round((video.fps / step) * 1000) / 1000,
      sourceFps: video.fps,
      step,
      frames: files.map((_, i) => {
        const frame = start + i * step;
        return { file: sequenceName(base, i, format), frame, time: times[frame] ?? null };
      }),
    };
    res.attachment(`${base}_frames-${start}-${end}.zip`).type('application/zip');
    const zip = new ZipWriter(res);
    for (const [i, file] of files.entries()) await zip.add(sequenceName(base, i, format), await readFile(file));
    await zip.add('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
    await zip.finish();
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

api.use((_req, _res) => {
  throw new HttpError(404, 'not_found', 'There’s no API route here.');
});

// Every error becomes { error: { code, message } }. A failure after a download has started can
// only cut the connection, which the browser reports as a failed download.
api.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    console.error('failed mid-response:', error);
    res.destroy();
    return;
  }
  if (error instanceof HttpError) return void res.status(error.status).json({ error: { code: error.code, message: error.message } });
  if (error instanceof MediaError) return void res.status(422).json({ error: { code: error.code, message: error.message } });
  if (error instanceof SyntaxError) return void res.status(400).json({ error: { code: 'bad_json', message: 'The request body isn’t valid JSON.' } });
  console.error(error);
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong on the server. Try again; if it keeps happening, check the server log.' } });
});
