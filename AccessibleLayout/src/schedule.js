// Wrenfield Frontend Day: one day, two rooms. Times are "HH:MM" and treated as the visitor's local time.
export const EVENT_DATE = new Date(2026, 9, 15); // Thursday 15 October 2026
export const ROOMS = ['Hall A', 'Hall B'];
export const CLOSE = '16:30';

// A slot is either one shared session (`session`) or two talks in parallel (`talks`, in ROOMS order).
// `glance` marks the slots shown in the day at a glance.
export const SLOTS = [
  { start: '08:30', glance: 'Doors open', session: { title: 'Registration and coffee', room: 'Foyer' }, quiet: true },
  { start: '09:15', glance: 'Opening keynote', session: { title: 'Accessible by default', speaker: 'Amara Okafor', room: 'Hall A' } },
  {
    start: '10:15',
    glance: 'Morning talks',
    talks: [
      { title: 'Semantic HTML is a feature', speaker: 'Tomasz Wiśniewski' },
      { title: 'Forms that explain their errors', speaker: 'Priya Raman' },
    ],
  },
  { start: '11:05', session: { title: 'Break', room: 'Foyer' }, quiet: true },
  {
    start: '11:30',
    talks: [
      { title: 'Designing for 400% zoom', speaker: 'Leilani Kahale' },
      { title: 'Screen reader testing in twenty minutes', speaker: 'Kwame Mensah' },
    ],
  },
  { start: '12:20', glance: 'Lunch', session: { title: 'Lunch', room: 'Foyer' }, quiet: true },
  {
    start: '13:30',
    glance: 'Afternoon talks',
    talks: [
      { title: 'Colour, contrast and dark mode', speaker: 'Mei-Lin Zhao' },
      { title: 'Motion that respects reduced motion', speaker: 'Rafael Duarte' },
    ],
  },
  {
    start: '14:20',
    talks: [
      { title: 'Focus management in single-page apps', speaker: 'Siobhán Byrne' },
      { title: 'Workshop: auditing a page with axe', speaker: 'Jonas Lindqvist' },
    ],
  },
  { start: '15:10', session: { title: 'Break', room: 'Foyer' }, quiet: true },
  { start: '15:30', glance: 'Closing panel', session: { title: 'What we still get wrong', speaker: "Chaired by Nadia Haddad, with the day's speakers", room: 'Hall A' } },
];

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const dayNumber = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

export const slotEnd = (index) => SLOTS[index + 1]?.start ?? CLOSE;

// Everything happening in a slot, each with its room.
export const sessionsIn = (slot) => (slot.session ? [slot.session] : slot.talks.map((talk, i) => ({ ...talk, room: ROOMS[i] })));

export function formatTime(hhmm) {
  const minutes = toMinutes(hhmm);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

// Minutes into the conference day at `now`: -Infinity before the day, Infinity after it.
export function dayMinutes(now) {
  const days = dayNumber(now) - dayNumber(EVENT_DATE);
  if (days !== 0) return days < 0 ? -Infinity : Infinity;
  return now.getHours() * 60 + now.getMinutes();
}

// Stamp ink for something running from `start` to `end`: fresh while it's on, dry once it's over.
export function inkFor(start, end, now) {
  const t = dayMinutes(now);
  if (t >= toMinutes(end)) return 'dry';
  return t >= toMinutes(start) ? 'fresh' : 'wet';
}

// Index of the slot running at `now`, or -1 when nothing is on.
export function slotAt(now) {
  const t = dayMinutes(now);
  if (!Number.isFinite(t) || t >= toMinutes(CLOSE)) return -1;
  return SLOTS.findLastIndex((slot) => t >= toMinutes(slot.start));
}

// What the live stamp says at `now`.
export function statusAt(now) {
  const days = dayNumber(EVENT_DATE) - dayNumber(now);
  const doors = formatTime(SLOTS[0].start);
  if (days > 1) return { headline: `${days} days to go`, detail: `doors open ${doors}` };
  if (days === 1) return { headline: 'Tomorrow', detail: `doors open ${doors}` };
  if (days < 0) return { headline: "That's a wrap", detail: 'see you next year' };

  const t = dayMinutes(now);
  if (t < toMinutes(SLOTS[0].start)) return { headline: 'Today', detail: `doors open at ${doors}` };
  if (t >= toMinutes(CLOSE)) return { headline: "That's a wrap", detail: 'thanks for coming' };
  return { headline: 'On now', detail: `until ${formatTime(slotEnd(slotAt(now)))}` };
}
