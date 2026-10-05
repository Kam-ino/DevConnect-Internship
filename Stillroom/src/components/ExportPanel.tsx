// Sequence export: a frame range as numbered images plus a manifest, sized for the web.
import { useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Copy, DownloadSimple } from '@phosphor-icons/react';
import { LIMITS, checkSequence, sequenceLength, type ImageFormat } from '../../shared/frames.ts';
import type { VideoRow } from '../../shared/types.ts';
import { ApiError, download } from '../lib/api.ts';

const WIDTHS = [1920, 1280, 960, 640, 480];

const SNIPPET = `// Scroll-scrubbed playback of an exported sequence.
// Unzip into /frames, then add a <canvas> to the page.
const manifest = await (await fetch('/frames/manifest.json')).json();
const frames = manifest.frames.map((f) => Object.assign(new Image(), { src: '/frames/' + f.file }));
const canvas = document.querySelector('canvas');
canvas.width = manifest.width;
canvas.height = manifest.height;
const context = canvas.getContext('2d');
function draw() {
  const progress = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const image = frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))];
  if (image.complete) context.drawImage(image, 0, 0);
}
addEventListener('scroll', () => requestAnimationFrame(draw), { passive: true });
frames[0].onload = draw;`;

export interface Range {
  start: number;
  end: number;
}

interface ExportProps {
  sb: SupabaseClient;
  video: VideoRow;
  frame: number;
  range: Range;
  onRange: (range: Range) => void;
  say: (message: string, tone?: 'info' | 'error') => void;
}

export default function ExportPanel({ sb, video, frame, range, onRange, say }: ExportProps) {
  const [step, setStep] = useState(1);
  const [width, setWidth] = useState<number | null>(WIDTHS.find((w) => w <= video.width && w <= 1280) ?? null);
  const [format, setFormat] = useState<ImageFormat>('webp');
  const [quality, setQuality] = useState(82);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const request = { start: range.start, end: range.end, step, width, format, quality };
  const checked = checkSequence(request, video.frame_count, video.width);
  const count = checked.ok ? sequenceLength(range.start, range.end, step) : 0;
  const outWidth = width ?? video.width;
  const outHeight = width ? Math.round((video.height * width) / video.width / 2) * 2 : video.height;
  const playback = Math.round((video.fps / step) * 100) / 100;

  async function run() {
    if (!checked.ok) return;
    controller.current = new AbortController();
    setBusy(true);
    say(`Extracting ${count} frames for the sequence…`);
    try {
      await download(sb, `/api/videos/${video.id}/export/sequence`, 'frames.zip', { method: 'POST', json: request, signal: controller.current.signal });
      say(`Sequence of ${count} frames downloaded.`);
    } catch (error) {
      if ((error as Error).name === 'AbortError') say('Export cancelled.');
      else say(`Couldn’t export the sequence. ${(error as ApiError).message}`, 'error');
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }

  const setNumber = (key: 'start' | 'end', value: string) => {
    const n = Number(value);
    if (value !== '' && Number.isFinite(n)) onRange({ ...range, [key]: Math.round(n) });
  };

  return (
    <section className="side-panel" aria-labelledby="export-title">
      <header className="side-head">
        <h2 id="export-title">Image sequence</h2>
      </header>
      <p className="side-note">Numbered frames and a manifest, for frame-by-frame animation on a website. Up to {LIMITS.maxExportFrames} frames.</p>

      <div className="range-row">
        <label className="field compact">
          <span>Start frame</span>
          <input type="number" inputMode="numeric" min={0} max={video.frame_count - 1} value={range.start} onChange={(e) => setNumber('start', e.target.value)} />
        </label>
        <button className="chip" type="button" onClick={() => onRange({ ...range, start: frame })} title="Shortcut: I">Use frame {frame}</button>
      </div>
      <div className="range-row">
        <label className="field compact">
          <span>End frame</span>
          <input type="number" inputMode="numeric" min={0} max={video.frame_count - 1} value={range.end} onChange={(e) => setNumber('end', e.target.value)} />
        </label>
        <button className="chip" type="button" onClick={() => onRange({ ...range, end: frame })} title="Shortcut: O">Use frame {frame}</button>
      </div>

      <div className="field-grid">
        <label className="field compact">
          <span>Every</span>
          <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 24, 30].map((n) => (
              <option key={n} value={n}>{n === 1 ? 'frame' : `${n}th frame`}</option>
            ))}
          </select>
        </label>
        <label className="field compact">
          <span>Width</span>
          <select value={width ?? 0} onChange={(e) => setWidth(Number(e.target.value) || null)}>
            <option value={0}>{video.width} px (full)</option>
            {WIDTHS.filter((w) => w < video.width).map((w) => <option key={w} value={w}>{w} px</option>)}
          </select>
        </label>
      </div>

      <fieldset className="format">
        <legend>Format</legend>
        {(['webp', 'png'] as const).map((f) => (
          <label key={f} className="radio">
            <input type="radio" name="sequence-format" value={f} checked={format === f} onChange={() => setFormat(f)} />
            <span>{f === 'webp' ? 'WebP' : 'PNG'}</span>
          </label>
        ))}
      </fieldset>
      {format === 'webp' && (
        <label className="field compact">
          <span>Quality <span className="figures">{quality}</span></span>
          <input type="range" min={40} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
        </label>
      )}

      <details className="snippet">
        <summary>Play it on a website</summary>
        <pre><code>{SNIPPET}</code></pre>
        <button className="chip" type="button" onClick={() => navigator.clipboard.writeText(SNIPPET).then(() => say('Code copied.'), () => say('Couldn’t copy. Select the code and copy it instead.', 'error'))}>
          <Copy size={16} aria-hidden="true" /> Copy code
        </button>
      </details>

      {/* The panel's one primary action: it stays in view at the bottom of the screen while any
          part of the panel is on screen. */}
      <div className="export-footer">
        {checked.ok ? (
          <p className="summary figures" aria-live="polite">
            {count} frames · {outWidth}×{outHeight} · plays at {playback} fps
          </p>
        ) : (
          <p className="form-error" role="alert">{checked.error}</p>
        )}
        <div className="export-actions">
          <button className="button button-chalk" type="button" onClick={() => void run()} disabled={!checked.ok || busy}>
            <DownloadSimple size={18} aria-hidden="true" /> {busy ? 'Extracting…' : 'Download ZIP'}
          </button>
          {busy && <button className="button button-quiet" type="button" onClick={() => controller.current?.abort()}>Cancel</button>}
        </div>
      </div>
    </section>
  );
}
