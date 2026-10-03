import { WEEK, formatHours, statusAt } from './hours.js';

// The slip is printed Monday first. Each row gets its own small tilt so it reads as hand-stamped.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TILT = ['-1.2deg', '0.8deg', '-0.5deg', '1.1deg', '-0.9deg', '0.6deg', '-1.4deg'];

export default function DueSlip() {
  const now = new Date();
  const status = statusAt(now);
  const todayRow = ORDER.indexOf(now.getDay());
  const stampDate = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <section className="slip due-slip" id="hours" aria-labelledby="hours-title">
      <h2 className="printed" id="hours-title">Opening hours</h2>

      <p className={`stamp status-stamp press ${status.open ? 'is-open' : 'is-closed'}`}>
        <span className="status-date">{stampDate}</span>{' '}
        <strong className="status-headline">{status.headline}</strong>{' '}
        {status.detail && <span className="status-detail">{status.detail}</span>}
      </p>

      {/* The slip's printed head. Decorative: the table caption names it for assistive tech. */}
      <p className="date-due" aria-hidden="true">Date due</p>

      <table className="due-table">
        <caption className="visually-hidden">Opening hours by day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Hours</th>
          </tr>
        </thead>
        <tbody>
          {ORDER.map((dayIndex, row) => {
            const day = WEEK[dayIndex];
            const isToday = row === todayRow;
            const ink = isToday ? 'fresh' : row < todayRow ? 'dry' : 'wet';
            return (
              <tr key={day.day} className={isToday ? 'is-today' : undefined}>
                <th scope="row" aria-current={isToday ? 'date' : undefined}>
                  {day.day}
                  {isToday && <span className="today-tag">Today</span>}
                </th>
                <td>
                  <span className={`stamp row-stamp ink-${ink}`} style={{ '--tilt': TILT[row] }}>
                    {formatHours(day)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="closure">
        <strong>Closed Saturday 31 October</strong> for floor repairs. The book drop stays open.
      </p>
    </section>
  );
}
