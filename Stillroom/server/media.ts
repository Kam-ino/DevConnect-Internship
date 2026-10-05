// Everything that touches ffmpeg. Pure file in, file (or buffer) out: no Supabase here, so it's testable.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import type { ImageFormat, SamplePlan } from '../shared/frames.ts';

const FFMPEG = ffmpegPath ?? 'ffmpeg';
const FFPROBE = ffprobeStatic.path;

// A media failure the user can act on; `code` is stable for the API and the tests.
export class MediaError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function run(bin: string, args: string[], onStderrLine?: (line: string) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    const out: Buffer[] = [];
    let tail = '';
    let partial = '';
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => {
      const text = partial + chunk.toString();
      const lines = text.split(/\r?\n/);
      partial = lines.pop() ?? '';
      for (const line of lines) onStderrLine?.(line);
      tail = (tail + chunk.toString()).slice(-2000);
    });
    child.on('error', (error) => reject(new MediaError('ffmpeg_missing', `Couldn't start ${bin}: ${error.message}`)));
    child.on('close', (code) => {
      if (partial) onStderrLine?.(partial);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(Object.assign(new Error(`${bin} exited with code ${code}`), { stderr: tail }));
    });
  });
}

export interface VideoInfo {
  container: 'mp4' | 'mov' | 'webm' | 'mkv';
  mimeType: string;
  extension: string;
  durationS: number;
  width: number; // as displayed, after any rotation
  height: number;
  fps: number;
  estimatedFrames: number;
  codec: string;
}

const rate = (text: string | undefined) => {
  const [num, den] = (text ?? '').split('/').map(Number);
  return num && den ? num / den : 0;
};

// Read a file's metadata. Throws MediaError('unreadable' | 'unsupported') for anything that isn't a
// video Stillroom can work with.
export async function probe(file: string, fileName = ''): Promise<VideoInfo> {
  let json: Buffer;
  try {
    json = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-select_streams', 'v:0', file]);
  } catch {
    throw new MediaError('unreadable', 'This file isn’t a video Stillroom can read. Try an MP4, MOV, WebM or MKV file.');
  }
  const data = JSON.parse(json.toString()) as {
    format?: { format_name?: string; duration?: string };
    streams?: Array<{
      codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string;
      nb_frames?: string; duration?: string; tags?: { rotate?: string }; side_data_list?: Array<{ rotation?: number }>;
    }>;
  };
  const stream = data.streams?.[0];
  const formatName = data.format?.format_name ?? '';
  const durationS = Number(data.format?.duration ?? stream?.duration ?? 0);
  const fps = rate(stream?.avg_frame_rate) || rate(stream?.r_frame_rate);
  if (!stream || stream.codec_type !== 'video' || !stream.width || !stream.height || !(durationS > 0) || !(fps > 0)) {
    throw new MediaError('unreadable', 'This file has no video track Stillroom can read. Try an MP4, MOV, WebM or MKV file.');
  }

  const ext = extname(fileName).toLowerCase();
  let container: VideoInfo['container'];
  if (formatName.includes('mp4') || formatName.includes('mov')) container = ext === '.mov' ? 'mov' : 'mp4';
  else if (formatName.includes('webm') || formatName.includes('matroska')) container = ext === '.webm' ? 'webm' : 'mkv';
  else throw new MediaError('unsupported', 'Stillroom reads MP4, MOV, WebM and MKV videos. Convert this file to MP4 and try again.');

  const rotation = Number(stream.tags?.rotate ?? stream.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0);
  const sideways = Math.abs(rotation) % 180 === 90;
  const frames = Number(stream.nb_frames);
  return {
    container,
    mimeType: { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' }[container],
    extension: container,
    durationS,
    width: sideways ? stream.height : stream.width,
    height: sideways ? stream.width : stream.height,
    fps,
    estimatedFrames: frames > 0 ? frames : Math.max(1, Math.round(durationS * fps)),
    codec: stream.codec_name ?? 'unknown',
  };
}

// Render the contact sheets (JPEG grids of thumbnails) and record every frame's timestamp, in one
// decoding pass. showinfo sits before select, so it reports every decoded frame in order.
export async function renderSheets(source: string, outDir: string, plan: SamplePlan, onFrame?: (frame: number) => void) {
  const times: number[] = [];
  const filters = [
    'showinfo',
    `select='not(mod(n,${plan.step}))'`,
    `scale=${plan.tileWidth}:${plan.tileHeight}:flags=bicubic`,
    `tile=${plan.cols}x${plan.rows}:color=black`,
  ].join(',');
  try {
    await run(
      FFMPEG,
      ['-hide_banner', '-nostdin', '-i', source, '-an', '-sn', '-dn', '-vf', filters, '-fps_mode', 'vfr', '-q:v', '4', '-start_number', '0', join(outDir, 'sheet-%03d.jpg')],
      (line) => {
        const match = /\bn:\s*(\d+)\s+pts:\s*-?\d+\s+pts_time:(-?[\d.]+)/.exec(line);
        if (!match) return;
        times[Number(match[1])] = Number(match[2]);
        onFrame?.(Number(match[1]));
      },
    );
  } catch {
    throw new MediaError('decode_failed', 'ffmpeg couldn’t decode this video all the way through. The file may be damaged; re-export it and upload again.');
  }
  const sheets = (await readdir(outDir)).filter((name) => /^sheet-\d{3}\.jpg$/.test(name)).sort();
  const decoded = times.filter((t) => Number.isFinite(t));
  if (!decoded.length || !sheets.length) throw new MediaError('decode_failed', 'ffmpeg found no frames in this video.');
  return { times: decoded, sheets };
}

const codecArgs = (format: ImageFormat, quality: number) =>
  format === 'png' ? ['-c:v', 'png'] : ['-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '4'];

const scaleArgs = (width: number | null) => (width ? [`scale=${width}:-2:flags=lanczos`] : []);

// One exact frame as an image. `seconds` comes from seekTime(), so the first decoded frame is the one asked for.
export async function extractFrame(source: string, seconds: number, format: ImageFormat, width: number | null, quality = 90): Promise<Buffer> {
  const filters = scaleArgs(width);
  const image = await run(FFMPEG, [
    '-hide_banner', '-nostdin', '-v', 'error', '-ss', seconds.toFixed(6), '-i', source, '-an', '-frames:v', '1',
    ...(filters.length ? ['-vf', filters.join(',')] : []), ...codecArgs(format, quality), '-f', 'image2pipe', 'pipe:1',
  ]).catch(() => {
    throw new MediaError('extract_failed', 'ffmpeg couldn’t extract that frame.');
  });
  if (!image.length) throw new MediaError('extract_failed', 'That frame is past the end of the video.');
  return image;
}

// A run of frames as numbered image files: count frames, every step-th, starting at the seek point.
export async function extractSequence(
  source: string, seconds: number, step: number, count: number, format: ImageFormat, width: number | null, quality: number, outDir: string,
): Promise<string[]> {
  const filters = [`select='not(mod(n,${step}))'`, ...scaleArgs(width)].join(',');
  await run(FFMPEG, [
    '-hide_banner', '-nostdin', '-v', 'error', '-ss', seconds.toFixed(6), '-i', source, '-an', '-vf', filters, '-fps_mode', 'passthrough',
    '-frames:v', String(count), ...codecArgs(format, quality), '-start_number', '0', join(outDir, `f_%05d.${format}`),
  ]).catch(() => {
    throw new MediaError('extract_failed', 'ffmpeg couldn’t extract that range of frames.');
  });
  return (await readdir(outDir)).filter((name) => name.startsWith('f_')).sort().map((name) => join(outDir, name));
}
