// The Stillroom mark: a plate ruled into a measured grid, with one frame held. The rules run past
// the plate's edge like the numbered lines on a motion-study backdrop.
export function Mark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="5" y="5" width="22" height="22" />
        <path d="M12.33 2.5v27M19.67 2.5v27M2.5 12.33h27M2.5 19.67h27" />
      </g>
      <rect x="19.67" y="12.33" width="7.33" height="7.34" fill="currentColor" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark size={26} />
      <span>Stillroom</span>
    </span>
  );
}
