// The inspector: the current frame, extracted exactly by the server, on the stage. The thumbnail
// shows instantly; the full frame replaces it when it arrives. A measuring grid can lie over it.
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VideoRow } from '../../shared/types.ts';
import { sampleOf } from '../../shared/frames.ts';
import { ApiError, request } from '../lib/api.ts';
import { tileStyle } from './Thumb.tsx';

// Recently viewed frames, as object URLs. ponytail: a small LRU; frames are cheap to re-fetch.
const cache = new Map<string, string>();
function remember(key: string, url: string) {
  cache.set(key, url);
  if (cache.size > 80) {
    const [oldest, stale] = cache.entries().next().value as [string, string];
    cache.delete(oldest);
    URL.revokeObjectURL(stale);
  }
}

const BUCKETS = [480, 960, 1440, 1920];

type Shown = { frame: number; url: string } | null;

interface InspectorProps {
  sb: SupabaseClient;
  video: VideoRow;
  sheets: readonly string[];
  frame: number;
  grid: number; // divisions of the measuring grid; 0 = off
}

export default function Inspector({ sb, video, sheets, frame, grid }: InspectorProps) {
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown>(null);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The smallest standard width that's sharp at this size, never more than the source.
  const needed = Math.round(width * Math.min(devicePixelRatio || 1, 2));
  const bucket = BUCKETS.find((b) => b >= needed);
  const requested = !bucket || bucket >= video.width ? null : bucket;

  useEffect(() => {
    if (!width) return;
    const key = `${video.id}:${frame}:${requested ?? 'full'}`;
    const hit = cache.get(key);
    setFailure('');
    if (hit) {
      setShown({ frame, url: hit });
      return;
    }
    const controller = new AbortController();
    // Wait a beat so holding an arrow key doesn't fire a request for every frame it passes.
    const timer = setTimeout(async () => {
      try {
        const res = await request(sb, `/api/videos/${video.id}/frames/${frame}?format=webp${requested ? `&width=${requested}` : ''}`, { signal: controller.signal });
        const url = URL.createObjectURL(await res.blob());
        remember(key, url);
        setShown({ frame, url });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setFailure((error as ApiError).message);
      }
    }, 110);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sb, video.id, frame, requested, width, attempt]);

  const exact = shown?.frame === frame;
  const lines = Array.from({ length: Math.max(0, grid - 1) }, (_, i) => ((i + 1) / grid) * 100);

  return (
    <div className="inspector" ref={box} style={{ aspectRatio: `${video.width} / ${video.height}`, width: `min(100%, calc(64vh * ${video.width / video.height}))` }}>
      <span className="inspector-placeholder" style={tileStyle(video, sheets, sampleOf(frame, video.sample_step))} aria-hidden="true" />
      {shown && <img className={exact ? '' : 'is-stale'} src={shown.url} alt={`Frame ${shown.frame} of ${video.title}`} />}
      {!exact && !failure && <span className="inspector-loading" aria-hidden="true">Developing frame {frame.toLocaleString('en')}…</span>}
      {grid > 0 && (
        <svg className="measure" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {lines.map((at) => (
            <g key={at}>
              <line x1={at} x2={at} y1={0} y2={100} />
              <line y1={at} y2={at} x1={0} x2={100} />
            </g>
          ))}
        </svg>
      )}
      {grid > 0 && (
        <div className="measure-labels" aria-hidden="true">
          {Array.from({ length: grid + 1 }, (_, i) => (
            <span key={i} style={{ left: `${(i / grid) * 100}%` }}>{i}</span>
          ))}
        </div>
      )}
      {failure && (
        <div className="inspector-error" role="alert">
          <p>Couldn’t develop frame {frame.toLocaleString('en')}. {failure}</p>
          <button className="button button-quiet" type="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      )}
    </div>
  );
}
