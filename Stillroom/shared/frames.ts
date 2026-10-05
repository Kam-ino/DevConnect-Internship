// Frame maths shared by the server and the app, so a frame number means the same frame everywhere.
// Frames are numbered from 0 in presentation order, exactly as ffmpeg decodes them.

export const LIMITS = {
  maxBytes: 50 * 1024 * 1024, // the free Supabase plan's per-file cap
  maxSeconds: 5 * 60,
  maxVideos: 5, // per account, enforced by the database
  maxSamples: 600, // thumbnails in a video's contact sheet
  maxExportFrames: 600, // frames in one sequence export
} as const;

export const SHEET = { cols: 10, rows: 10, tileWidth: 160 } as const;

export type ImageFormat = 'png' | 'webp';
export const IMAGE_FORMATS: readonly ImageFormat[] = ['webp', 'png'];

export interface SamplePlan {
  step: number; // every step-th frame is in the contact sheet
  count: number; // thumbnails in the contact sheet
  tileWidth: number;
  tileHeight: number;
  cols: number;
  rows: number;
  sheets: number;
}

// Choose the contact sheet's sampling: every frame when that fits in maxSamples, otherwise every n-th.
export function planSamples(frameCount: number, width: number, height: number): SamplePlan {
  const step = Math.max(1, Math.ceil(frameCount / LIMITS.maxSamples));
  const count = Math.ceil(frameCount / step);
  const tileHeight = Math.max(2, Math.round((SHEET.tileWidth * height) / width / 2) * 2);
  return {
    step,
    count,
    tileWidth: SHEET.tileWidth,
    tileHeight,
    cols: SHEET.cols,
    rows: SHEET.rows,
    sheets: Math.ceil(count / (SHEET.cols * SHEET.rows)),
  };
}

// Where a thumbnail sits: its sheet, column and row.
export function tileOf(sample: number, cols: number, rows: number) {
  const perSheet = cols * rows;
  const cell = sample % perSheet;
  return { sheet: Math.floor(sample / perSheet), col: cell % cols, row: Math.floor(cell / cols) };
}

// The thumbnail that shows a frame (or the nearest one before it, when the sheet skips frames).
export const sampleOf = (frame: number, step: number) => Math.floor(frame / step);

export const clampFrame = (frame: number, frameCount: number) => Math.min(Math.max(0, Math.round(frame)), frameCount - 1);

// Seek target for frame k: halfway between frame k-1 and frame k, so rounding in the stored
// timestamps can never land on the neighbour. Works for variable frame rates too.
export function seekTime(times: readonly number[], frame: number): number {
  const at = times[frame] ?? 0;
  const before = frame > 0 ? (times[frame - 1] ?? at) : at - 0.5;
  return Math.max(0, (before + at) / 2);
}

// Non-drop-frame timecode for a frame number, HH:MM:SS:FF, counted at the video's nominal rate.
export function timecode(frame: number, fps: number): string {
  const rate = Math.max(1, Math.round(fps));
  const ff = frame % rate;
  const totalSeconds = Math.floor(frame / rate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor(totalSeconds / 60) % 60)}:${pad(totalSeconds % 60)}:${pad(ff)}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds * 10) / 10;
  const minutes = Math.floor(s / 60);
  const rest = s - minutes * 60;
  return minutes ? `${minutes} min ${Math.round(rest)} s` : `${rest.toFixed(rest < 10 ? 1 : 0)} s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A sequence export request: frames start..end (inclusive), every step-th, scaled to width (null keeps
// the source size; never larger than the source, because Stillroom never upscales).
export interface SequenceRequest {
  start: number;
  end: number;
  step: number;
  width: number | null;
  format: ImageFormat;
  quality: number; // WebP quality, 1-100
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

export function checkSequence(input: unknown, frameCount: number, sourceWidth: number): Checked<SequenceRequest> {
  const body = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const { start, end, step = 1, width = null, format = 'webp', quality = 82 } = body;
  if (!isInt(start) || !isInt(end)) return { ok: false, error: 'Start and end must be whole frame numbers.' };
  if (start < 0 || end >= frameCount) return { ok: false, error: `Frames run from 0 to ${frameCount - 1}.` };
  if (end < start) return { ok: false, error: 'The end frame comes before the start frame.' };
  if (!isInt(step) || step < 1) return { ok: false, error: 'Step must be a whole number of 1 or more.' };
  if (width !== null && (!isInt(width) || width < 16)) return { ok: false, error: 'Width must be a whole number of pixels, at least 16.' };
  if (width !== null && width > sourceWidth) return { ok: false, error: `Width can't be larger than the source (${sourceWidth} px): Stillroom never upscales.` };
  if (format !== 'webp' && format !== 'png') return { ok: false, error: 'Format must be WebP or PNG.' };
  if (!isInt(quality) || quality < 1 || quality > 100) return { ok: false, error: 'Quality must be between 1 and 100.' };
  const frames = sequenceLength(start, end, step);
  if (frames > LIMITS.maxExportFrames) {
    return { ok: false, error: `That's ${frames} frames; one export holds at most ${LIMITS.maxExportFrames}. Raise the step or shorten the range.` };
  }
  return { ok: true, value: { start, end, step, width, format, quality } };
}

export const sequenceLength = (start: number, end: number, step: number) => Math.floor((end - start) / step) + 1;

// File names inside an export: zero-padded so they sort in order everywhere.
export const sequenceName = (base: string, index: number, format: ImageFormat) => `${base}_${String(index).padStart(4, '0')}.${format}`;

// A file-system-safe base name from a video title.
export function slug(title: string): string {
  const cleaned = title.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').toLowerCase();
  return cleaned.slice(0, 60) || 'frames';
}
