// A synthetic motion-study plate for the sign-in screen: twelve numbered frames of a bouncing ball,
// read against a measuring grid. A chalk mat steps through them at 12 frames a second, so the plate
// shows what Stillroom does: motion broken into exact, numbered frames. Each frame is its own small
// SVG and its number is real text, so the numbers stay readable at any width.
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const FRAMES = 12;
const W = 160;
const H = 120;

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

  return (
    <figure className="study-plate">
      <div className="sp-grid" role="img" aria-label="Twelve numbered frames of a ball bouncing across a measuring grid">
        {Array.from({ length: FRAMES }, (_, i) => {
          const b = ball(i);
          return (
            <div key={i} className={`sp-cell${!reduced && i === current ? ' is-current' : ''}`} aria-hidden="true">
              <svg viewBox={`0 0 ${W} ${H}`}>
                <rect width={W} height={H} className="sp-frame" />
                {Array.from({ length: 9 }, (_, k) => (
                  <line key={`v${k}`} x1={(k + 1) * (W / 10)} x2={(k + 1) * (W / 10)} y1={0} y2={H} className="sp-rule" />
                ))}
                {Array.from({ length: 5 }, (_, k) => (
                  <line key={`h${k}`} y1={(k + 1) * (H / 6)} y2={(k + 1) * (H / 6)} x1={0} x2={W} className="sp-rule" />
                ))}
                <ellipse cx={b.x} cy={b.ground + 7} rx={11 * b.shadow} ry={2.4 * b.shadow} className="sp-shadow" />
                <ellipse cx={b.x} cy={b.y} rx={b.rx} ry={b.ry} className="sp-ball" />
              </svg>
              <span className="sp-number">{String(i + 1).padStart(2, '0')}</span>
            </div>
          );
        })}
      </div>
      <figcaption>
        <span>Plate 1 · Bouncing ball · 12 frames at 12 fps</span>
        <span>Synthetic demonstration sequence</span>
      </figcaption>
    </figure>
  );
}
