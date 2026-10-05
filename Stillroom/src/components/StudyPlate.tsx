// A synthetic motion-study plate for the sign-in screen: twelve numbered frames of a bouncing ball,
// read against a measuring grid. A chalk mat steps through them at 12 frames a second, so the plate
// shows what Stillroom does: motion broken into exact, numbered frames.
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const FRAMES = 12;
const COLS = 4;
const W = 160;
const H = 120;
const GAP = 14;
const LABEL = 18;

function ball(i: number) {
  const t = i / (FRAMES - 1);
  const x = 20 + t * (W - 40);
  const height = Math.abs(Math.sin(t * Math.PI * 1.5)) * (1 - t * 0.45); // two bounces, losing height
  const ground = H - 22;
  const y = ground - height * 72;
  const squash = height < 0.08 ? 1.35 : 1;
  return { x, y, rx: 9 * squash, ry: 9 / squash, shadow: 0.35 + (1 - height) * 0.65, ground };
}

export default function StudyPlate() {
  const reduced = useReducedMotion();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setCurrent((n) => (n + 1) % FRAMES), 1000 / 12);
    return () => clearInterval(timer);
  }, [reduced]);

  const rows = Math.ceil(FRAMES / COLS);
  const width = COLS * W + (COLS - 1) * GAP;
  const height = rows * (H + LABEL) + (rows - 1) * GAP;

  return (
    <figure className="study-plate">
      <svg viewBox={`-2 -2 ${width + 4} ${height + 4}`} role="img" aria-label="Twelve numbered frames of a ball bouncing across a measuring grid">
        {Array.from({ length: FRAMES }, (_, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const ox = col * (W + GAP);
          const oy = row * (H + LABEL + GAP);
          const b = ball(i);
          const active = !reduced && i === current;
          return (
            <g key={i} transform={`translate(${ox} ${oy})`}>
              <rect width={W} height={H} className="sp-frame" />
              {Array.from({ length: 9 }, (_, k) => (
                <line key={`v${k}`} x1={(k + 1) * (W / 10)} x2={(k + 1) * (W / 10)} y1={0} y2={H} className="sp-rule" />
              ))}
              {Array.from({ length: 5 }, (_, k) => (
                <line key={`h${k}`} y1={(k + 1) * (H / 6)} y2={(k + 1) * (H / 6)} x1={0} x2={W} className="sp-rule" />
              ))}
              <ellipse cx={b.x} cy={b.ground + 7} rx={11 * b.shadow} ry={2.4 * b.shadow} className="sp-shadow" />
              <ellipse cx={b.x} cy={b.y} rx={b.rx} ry={b.ry} className="sp-ball" />
              {active && <rect x={-3} y={-3} width={W + 6} height={H + 6} className="sp-mat" />}
              <text x={0} y={H + 13} className="sp-number">{String(i + 1).padStart(2, '0')}</text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span>Plate 1 · Bouncing ball · 12 frames at 12 fps</span>
        <span>Synthetic demonstration sequence</span>
      </figcaption>
    </figure>
  );
}
