import { CLOSE, SLOTS, formatTime, inkFor, sessionsIn, slotAt, statusAt } from './schedule.js';

// The day at a glance: the marked slots, each running until the next marked one.
const GLANCE = SLOTS.filter((slot) => slot.glance).map((slot, i, rows) => ({
  label: slot.glance,
  start: slot.start,
  end: rows[i + 1]?.start ?? CLOSE,
}));
GLANCE.push({ label: 'Doors close', start: CLOSE, end: CLOSE });

// Each row gets its own small tilt so it reads as hand-stamped.
const TILT = ['-1.2deg', '0.8deg', '-0.5deg', '1.1deg', '-0.9deg', '0.6deg', '-1.4deg'];

export default function ProgrammeSlip({ now, preview }) {
  const status = statusAt(now);
  const current = slotAt(now);

  return (
    <section className="slip programme" id="glance" aria-labelledby="glance-title">
      <h2 className="printed" id="glance-title">The day at a glance</h2>

      <p className="stamp status-stamp press">
        <strong className="status-headline">{status.headline}</strong>{' '}
        <span className="status-detail">{status.detail}</span>
      </p>

      {/* During the day, say exactly which talks to walk into, without scanning the full table */}
      {current >= 0 && (
        <ul className="now-sessions" aria-label="On now">
          {sessionsIn(SLOTS[current]).map((session) => (
            <li key={session.title}>{session.title}, {session.room}</li>
          ))}
        </ul>
      )}

      <p className="printed-head">Thursday 15 October</p>

      <table className="glance-table">
        <caption className="visually-hidden">Main times on Thursday 15 October</caption>
        <thead>
          <tr>
            <th scope="col">What</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {GLANCE.map((row, i) => {
            const ink = inkFor(row.start, row.end, now);
            return (
              <tr key={row.label} className={`ink-${ink}`}>
                <th scope="row" aria-current={ink === 'fresh' ? 'time' : undefined}>
                  {row.label}
                  {ink === 'fresh' && <span className="now-tag">On now</span>}
                </th>
                <td>
                  <time className="stamp row-stamp" style={{ '--tilt': TILT[i] }} dateTime={`2026-10-15T${row.start}`}>
                    {formatTime(row.start)}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="slip-note">Free entry. Every talk is captioned and streamed live.</p>
      {preview && (
        <p className="preview-note">
          Previewing {now.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. <a href="./">Show the real time</a>
        </p>
      )}
    </section>
  );
}
