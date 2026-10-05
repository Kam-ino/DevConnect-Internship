// The contact sheet: every sampled frame as a numbered thumbnail. The plate you're on wears a white
// mat; kept frames carry a buff tab; frames inside the export range are underlined.
import { useEffect, useRef, type CSSProperties } from 'react';
import { sampleOf } from '../../shared/frames.ts';
import type { VideoRow } from '../../shared/types.ts';
import { tileStyle } from './Thumb.tsx';

interface SheetProps {
  video: VideoRow;
  sheets: readonly string[];
  frame: number;
  kept: ReadonlySet<number>;
  range: { start: number; end: number };
  onSelect: (frame: number) => void;
}

export default function ContactSheet({ video, sheets, frame, kept, range, onSelect }: SheetProps) {
  const grid = useRef<HTMLOListElement>(null);
  const step = video.sample_step;
  const current = sampleOf(frame, step);

  // Keep the current plate in view, and keep keyboard focus on it while the sheet has focus.
  useEffect(() => {
    const cell = grid.current?.querySelector<HTMLButtonElement>(`[data-sample="${current}"]`);
    if (!cell) return;
    if (grid.current?.contains(document.activeElement)) cell.focus({ preventScroll: true });
    cell.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const keptSamples = new Set([...kept].map((f) => sampleOf(f, step)));

  return (
    <ol className="contact-sheet" ref={grid} aria-label={`Contact sheet: ${video.sample_count} frames${step > 1 ? `, every ${step}th` : ''}`}>
      {Array.from({ length: video.sample_count }, (_, sample) => {
        const at = sample * step;
        const inRange = at >= range.start && at <= range.end;
        const isCurrent = sample === current;
        return (
          <li key={sample} style={{ '--i': Math.min(sample, 80) } as CSSProperties}>
            <button
              type="button"
              data-sample={sample}
              className={`sheet-cell${isCurrent ? ' is-current' : ''}${keptSamples.has(sample) ? ' is-kept' : ''}${inRange ? ' is-in-range' : ''}`}
              tabIndex={isCurrent ? 0 : -1}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`Frame ${at}${keptSamples.has(sample) ? ', kept' : ''}`}
              onClick={() => onSelect(at)}
            >
              <span className="thumb" style={tileStyle(video, sheets, sample)} />
              <span className="sheet-number">{at}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
