// Progress drawn as a measuring scale; value null means "working, amount unknown".
export default function Scale({ value, label }: { value: number | null; label: string }) {
  return (
    <div
      className={`scale${value === null ? ' is-indeterminate' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(value * 100)}
    >
      <span style={{ transform: `scaleX(${value ?? 1})` }} />
    </div>
  );
}
