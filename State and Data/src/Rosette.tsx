import { useMemo } from 'react';

// A guilloche rosette, the looping line work printed on banknotes. It's generated from a seed
// (the currency pair), so every pair gets its own pattern. Purely decorative: hidden from assistive tech.

const STEPS = 720;

function seededRandom(seed: string) {
  let h = 2166136261;
  for (const char of seed) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    return h / 2 ** 32;
  };
}

// An epitrochoid with `lobes` loops, scaled to `radius` and turned by `turn` radians, as SVG path data.
function epitrochoid(lobes: number, depth: number, radius: number, turn: number) {
  const R = lobes;
  const r = 1;
  const d = depth;
  const scale = radius / (R + r + d);
  let path = '';
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * Math.PI * 2;
    const x = (R + r) * Math.cos(t) - d * Math.cos((R + r) * t);
    const y = (R + r) * Math.sin(t) - d * Math.sin((R + r) * t);
    const px = 100 + scale * (x * Math.cos(turn) - y * Math.sin(turn));
    const py = 100 + scale * (x * Math.sin(turn) + y * Math.cos(turn));
    path += `${i ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`;
  }
  return path;
}

export function rosettePaths(seed: string) {
  const random = seededRandom(seed);
  const layers = [
    { radius: 96, lobes: 14 + Math.floor(random() * 10), copies: 6 },
    { radius: 70, lobes: 9 + Math.floor(random() * 7), copies: 5 },
    { radius: 44, lobes: 6 + Math.floor(random() * 5), copies: 4 },
  ];
  return layers.flatMap(({ radius, lobes, copies }, layer) => {
    const depth = 1.5 + random() * 2.5;
    return Array.from({ length: copies }, (_, copy) => ({
      d: epitrochoid(lobes, depth, radius, (copy / copies) * ((Math.PI * 2) / lobes)),
      layer,
    }));
  });
}

interface RosetteProps {
  seed: string;
  engraving?: 'once' | 'loop';
  layers?: number; // fewer layers = an unfinished plate (used while loading)
}

export default function Rosette({ seed, engraving = 'once', layers = 3 }: RosetteProps) {
  const paths = useMemo(() => rosettePaths(seed).filter((path) => path.layer < layers), [seed, layers]);
  return (
    <svg className={`rosette engrave-${engraving}`} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      {paths.map(({ d, layer }, i) => (
        <path key={`${seed}-${i}`} d={d} pathLength={1} className={`rosette-line layer-${layer}`} style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </svg>
  );
}
