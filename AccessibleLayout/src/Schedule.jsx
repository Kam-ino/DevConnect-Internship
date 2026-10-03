import { ROOMS, SLOTS, formatTime, inkFor, slotEnd } from './schedule.js';

function Session({ title, speaker, room }) {
  return (
    <>
      <span className="session-title">{title}</span>
      {speaker && <span className="speaker">{speaker}</span>}
      {room && <span className="session-room">{room}</span>}
    </>
  );
}

// A real table: times are row headers, rooms are column headers. The explicit roles look
// redundant, but they keep the table semantics when the phone layout turns rows into blocks.
export default function Schedule({ now }) {
  return (
    // Named by the visible section heading: a hidden <caption> stops naming the table once it's restyled for phones.
    <table className="schedule" role="table" aria-labelledby="schedule-title">
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">Time</th>
          {ROOMS.map((room) => (
            <th role="columnheader" scope="col" key={room}>{room}</th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {SLOTS.map((slot, i) => {
          const ink = inkFor(slot.start, slotEnd(i), now);
          return (
            <tr role="row" key={slot.start} className={`ink-${ink}${slot.quiet ? ' is-quiet' : ''}`}>
              <th role="rowheader" scope="row" aria-current={ink === 'fresh' ? 'time' : undefined}>
                <time className="stamp row-stamp" dateTime={`2026-10-15T${slot.start}`}>{formatTime(slot.start)}</time>
                {ink === 'fresh' && <span className="now-tag">On now</span>}
              </th>
              {slot.session ? (
                <td role="cell" colSpan={ROOMS.length}>
                  <Session {...slot.session} />
                </td>
              ) : (
                slot.talks.map((talk, t) => (
                  <td role="cell" key={talk.title}>
                    {/* Only shown on phones, where the room column headers are hidden */}
                    <span className="room-tag">{ROOMS[t]}</span>
                    <Session {...talk} />
                  </td>
                ))
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
