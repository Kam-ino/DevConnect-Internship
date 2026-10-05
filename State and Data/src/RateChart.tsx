import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { formatDate, formatRate, niceScale, timeTicks, type RatePoint } from './rates.ts';

const HEIGHT = 200;
const PAD = { top: 14, right: 76, bottom: 28, left: 56 };
const LABEL_WIDTH = 72; // room each date label needs on the x axis
// The start label fits the 48px axis gutter; the exact rate is in the tooltip and the table
const startFormat = new Intl.NumberFormat('en', { maximumSignificantDigits: 4 });

function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry ? entry.contentRect.width : 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

interface RateChartProps {
  points: RatePoint[];
  from: string;
  to: string;
  dimmed?: boolean; // a refetch is under way; keep the old line on screen, faded
}

// A line chart of the daily rate, engraved like a banknote: a 2px copper line, with 45-degree hatching
// between the line and the period's opening rate (so the fill shows the change, not a fake magnitude
// from a truncated baseline). Hover or focus it to read any day: the crosshair snaps to the nearest
// date, arrow keys step through days.
export default function RateChart({ points, from, to, dimmed = false }: RateChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const hatchId = `hatch-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const [active, setActive] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null); // so quick key repeats step from the latest position
  const [readout, setReadout] = useState('');

  const chart = useMemo(() => {
    if (width === 0 || points.length < 2) return null;
    const rates = points.map((point) => point.rate);
    const { low, high, ticks, decimals } = niceScale(Math.min(...rates), Math.max(...rates), 4);
    const tickFormat = new Intl.NumberFormat('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const plotWidth = width - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const x = (index: number) => PAD.left + (index / (points.length - 1)) * plotWidth;
    const y = (value: number) => PAD.top + ((high - value) / (high - low)) * plotHeight;
    const line = points.map((point, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(point.rate).toFixed(1)}`).join('');
    const baseline = PAD.top + plotHeight;
    const opening = y(points[0]!.rate);
    const area = `${line}L${x(points.length - 1).toFixed(1)} ${opening.toFixed(1)}L${PAD.left} ${opening.toFixed(1)}Z`;
    const dates = timeTicks(points, Math.floor(plotWidth / LABEL_WIDTH));
    return { x, y, line, area, ticks, tickFormat, dates, plotWidth, baseline, opening };
  }, [points, width]);

  const last = points.length - 1;
  const describe = (index: number) => {
    const point = points[index];
    return point ? `${formatDate(point.date)}: 1 ${from} = ${formatRate(point.rate)} ${to}` : '';
  };

  function move(index: number | null, announce = false) {
    activeRef.current = index;
    setActive(index);
    if (announce && index !== null) setReadout(describe(index));
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!chart || !wrapRef.current) return;
    const left = wrapRef.current.getBoundingClientRect().left;
    const ratio = (event.clientX - left - PAD.left) / chart.plotWidth;
    move(Math.max(0, Math.min(last, Math.round(ratio * last))));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = activeRef.current ?? last;
    const steps: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last };
    const next = steps[event.key];
    if (next === undefined) return;
    event.preventDefault();
    move(Math.max(0, Math.min(last, next)), true);
  }

  const point = active !== null ? points[active] : undefined;
  const endPoint = points[last];
  const tooltipLeft = chart && active !== null ? chart.x(active) : 0;
  const flip = tooltipLeft > width / 2;

  return (
    <>
      <div
        ref={wrapRef}
        className={`chart${dimmed ? ' is-dimmed' : ''}`}
        tabIndex={0}
        role="group"
        aria-label={`Rate history for ${from} to ${to}. Use the left and right arrow keys to read each day.`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => move(null)}
        onKeyDown={handleKeyDown}
        onFocus={() => move(last, true)}
        onBlur={() => move(null)}
      >
        {chart && endPoint && (
          <svg width={width} height={HEIGHT} aria-hidden="true" focusable="false">
            <defs>
              <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="4" className="hatch-line" />
              </pattern>
            </defs>
            {chart.ticks.map((tick) => (
              <g key={tick}>
                <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={chart.y(tick)} y2={chart.y(tick)} />
                {/* A tick label the start label would sit on gives way to it */}
                {Math.abs(chart.y(tick) - chart.opening) > 13 && (
                  <text className="tick" x={PAD.left - 8} y={chart.y(tick)} dy="0.32em" textAnchor="end">{chart.tickFormat.format(tick)}</text>
                )}
              </g>
            ))}
            <path d={chart.area} fill={`url(#${hatchId})`} />
            {/* The opening rate: the hatching runs from here to the line. A hollow marker starts the line
                and its value sits in the axis gutter, level with the hairline, so the series never crosses it. */}
            <line className="opening" x1={PAD.left} x2={width - PAD.right} y1={chart.opening} y2={chart.opening} />
            <path className="line" d={chart.line} />
            <circle className="start-marker" cx={PAD.left} cy={chart.opening} r="3.5" />
            <text className="start-label" x={PAD.left - 8} y={chart.opening} dy="0.32em" textAnchor="end">
              {startFormat.format(points[0]!.rate)}
            </text>
            {chart.dates.map(({ index, label }) => (
              <g key={index}>
                <line className="grid" x1={chart.x(index)} x2={chart.x(index)} y1={chart.baseline} y2={chart.baseline + 5} />
                <text className="tick" x={chart.x(index)} y={HEIGHT - 6} textAnchor="middle">{label}</text>
              </g>
            ))}
            {/* The latest value, labelled at the end of the line */}
            <circle className="marker" cx={chart.x(last)} cy={chart.y(endPoint.rate)} r="4" />
            <text className="end-label" x={chart.x(last) + 9} y={chart.y(endPoint.rate)} dy="0.32em">{formatRate(endPoint.rate)}</text>
            {point && active !== null && (
              <g>
                <line className="crosshair" x1={chart.x(active)} x2={chart.x(active)} y1={PAD.top} y2={chart.baseline} />
                <circle className="marker" cx={chart.x(active)} cy={chart.y(point.rate)} r="4" />
              </g>
            )}
          </svg>
        )}
        {point && chart && (
          <div className={`tooltip${flip ? ' is-flipped' : ''}`} style={{ left: tooltipLeft }} aria-hidden="true">
            <strong>{formatRate(point.rate)} {to}</strong>
            <span>{formatDate(point.date)}</span>
          </div>
        )}
      </div>
      {/* Keyboard readout: the tooltip's text, announced as the arrow keys move */}
      <p className="visually-hidden" aria-live="polite">{readout}</p>
    </>
  );
}
