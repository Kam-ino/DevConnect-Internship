// Opening hours, indexed by Date#getDay() (0 = Sunday). Times are 24-hour numbers.
export const WEEK = [
  { day: 'Sunday', open: 12, close: 16 },
  { day: 'Monday', open: null, close: null },
  { day: 'Tuesday', open: 9, close: 19 },
  { day: 'Wednesday', open: 9, close: 19 },
  { day: 'Thursday', open: 9, close: 20 },
  { day: 'Friday', open: 9, close: 19 },
  { day: 'Saturday', open: 10, close: 17 },
];

// One-off closures, keyed by local date.
export const CLOSURES = {
  '2026-10-31': 'floor repairs',
};

export function formatHour(hour) {
  if (hour === 12) return 'noon';
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`;
}

export function formatHours({ open, close }) {
  if (open === null) return 'Closed';
  const start = formatHour(open);
  return `${start[0].toUpperCase()}${start.slice(1)} to ${formatHour(close)}`;
}

const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Whether the library is open at `now`, phrased for the status stamp.
export function statusAt(now) {
  const closure = CLOSURES[dateKey(now)];
  const today = WEEK[now.getDay()];
  const hour = now.getHours() + now.getMinutes() / 60;

  if (!closure && today.open !== null) {
    if (hour >= today.open && hour < today.close) {
      return { open: true, headline: 'Open now', detail: `until ${formatHour(today.close)}` };
    }
    if (hour < today.open) {
      return { open: false, headline: 'Closed now', detail: `opens today at ${formatHour(today.open)}` };
    }
  }

  const headline = closure ? 'Closed today' : 'Closed now';
  for (let i = 1; i <= 7; i++) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const day = WEEK[next.getDay()];
    if (day.open !== null && !CLOSURES[dateKey(next)]) {
      const when = i === 1 ? 'tomorrow' : day.day;
      return { open: false, headline, detail: `opens ${when} at ${formatHour(day.open)}` };
    }
  }
  return { open: false, headline, detail: '' };
}
