import { useId } from 'react';
import { currencyName } from './rates.ts';

const TEETH = 60;

// A toothed seal in serial green, printed where a banknote carries its seal. Generic geometry
// with the target currency's code and name (no official emblem). Decorative: hidden from assistive tech.
export default function Seal({ code }: { code: string }) {
  const ringId = `seal-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const teeth = Array.from({ length: TEETH * 2 }, (_, i) => {
    const radius = i % 2 ? 45.5 : 49;
    const angle = (i / (TEETH * 2)) * Math.PI * 2;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');

  return (
    <svg className="seal" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <path id={ringId} d="M50 50 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" />
      </defs>
      <polygon className="seal-teeth" points={teeth} />
      <circle className="seal-ring" cx="50" cy="50" r="41.5" />
      <circle className="seal-ring" cx="50" cy="50" r="26" />
      <text className="seal-legend">
        <textPath href={`#${ringId}`} textLength="215" lengthAdjust="spacingAndGlyphs">
          {`${currencyName(code).toUpperCase()} · SPECIMEN · REFERENCE RATE ·`}
        </textPath>
      </text>
      <text className="seal-code" x="50" y="50" dy="0.36em" textAnchor="middle">{code}</text>
    </svg>
  );
}
