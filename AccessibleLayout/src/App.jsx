import DueSlip from './DueSlip.jsx';
import CardForm from './CardForm.jsx';

const EVENTS = [
  {
    title: 'E-book help drop-in',
    start: '2026-10-10T10:30',
    when: 'Saturday, 10:30 am to 12:30 pm',
    where: 'Main desk, ground floor. Adults and teens.',
    text: "Bring a phone, tablet or e-reader and we'll set up free e-book borrowing with your card.",
  },
  {
    title: 'Story time for under-fives',
    start: '2026-10-14T10:30',
    when: 'Wednesday, 10:30 am',
    where: "Children's room. Ages 0 to 5 with a grown-up.",
    text: 'Picture books, songs and a craft table.',
  },
  {
    title: 'Large-print book swap',
    start: '2026-10-22T14:00',
    when: 'Thursday, 2 pm to 4 pm',
    where: 'Reading room. Everyone welcome.',
    text: "Bring large-print books you've finished and take home new ones.",
  },
  {
    title: 'Try a screen reader',
    start: '2026-10-29T18:00',
    when: 'Thursday, 6 pm to 7:30 pm',
    where: 'Study room 2. Laptops provided.',
    text: 'A hands-on introduction to NVDA and VoiceOver.',
  },
];

const QUESTIONS = [
  {
    q: 'Do I need a card to visit?',
    a: 'No. Anyone can come in to read, use a desk or connect to the free Wi-Fi. You only need a card to borrow.',
  },
  {
    q: 'Is the building step-free?',
    a: 'Yes. There is a ramp at the Harbor Road entrance, a lift to both floors and an accessible toilet on the ground floor. The main desk has a hearing loop.',
  },
  {
    q: 'How many items can I borrow?',
    a: 'Up to 12 items for three weeks. You can renew each item twice, online or at the desk.',
  },
  {
    q: 'What happens if I return something late?',
    a: "We don't charge late fees. We'll email you a reminder, and you can bring it back next time you visit.",
  },
];

// The next upcoming event gets the biggest stamp; events already over are stamped in dry ink.
function inkFor(index, now) {
  const next = EVENTS.findIndex((event) => new Date(event.start) >= now);
  if (next === -1 || index < next) return 'past';
  return index === next ? 'next' : 'later';
}

const stampDay = (start) => new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// Roughens stamped type so it reads as rubber on paper. The text underneath stays real, selectable text.
function InkFilter() {
  return (
    <svg className="ink-filter" aria-hidden="true" focusable="false">
      <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="9" result="speckle" />
        <feColorMatrix in="speckle" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 6.4" result="holes" />
        <feComposite in="rough" in2="holes" operator="in" />
      </filter>
      {/* Small stamps only get rough edges: speckle holes would cost legibility at that size. */}
      <filter id="ink-fine" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

export default function App() {
  const now = new Date();

  return (
    <>
      <InkFilter />
      <a className="skip-link" href="#main">Skip to main content</a>

      <header className="site-header wrap">
        <a className="brand" href="./">Wrenfield Library</a>
        <nav aria-label="Main">
          <ul className="nav" role="list">
            <li><a href="#hours">Opening hours</a></li>
            <li><a href="#events">Events</a></li>
            <li><a href="#faq">Questions</a></li>
            <li><a href="#card">Get a card</a></li>
          </ul>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="hero wrap axis" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">Your library on Harbor Road</h1>
            <p className="lede">Borrow books, find a quiet desk or join a free class. Everyone is welcome, card or no card.</p>
            <a className="button" href="#card">Get a card</a>
          </div>
          <DueSlip />
        </section>

        <section className="visit wrap axis" aria-labelledby="visit-title">
          <img className="plate" src="https://picsum.photos/id/192/1200/900" width="1200" height="900" loading="lazy"
            alt="People working at long tables in a reading room with floor-to-ceiling windows." />
          <div className="visit-copy">
            <h2 id="visit-title">Find us</h2>
            <address>418 Harbor Road, Wrenfield</address>
            <p>Buses 12 and 40 stop outside. Bike racks are by the side entrance, and the main entrance is step-free.</p>
          </div>
        </section>

        <section className="events-section wrap axis" id="events" aria-labelledby="events-title">
          <div className="section-intro">
            <h2 id="events-title">Events in October</h2>
            <p>All events are free. Drop in, no booking needed.</p>
          </div>
          <ol className="slip events" role="list">
            {EVENTS.map((event, index) => {
              const ink = inkFor(index, now);
              return (
                <li key={event.title} className={`event ink-${ink}`}>
                  <h3>{event.title}</h3>
                  <p className="event-stamp">
                    <time className="stamp" dateTime={event.start}>{stampDay(event.start)}</time>
                  </p>
                  <p className="ticket">
                    {ink === 'past' && <strong>This event has passed. </strong>}
                    {event.when}
                    <br />
                    {event.where}
                  </p>
                  <p className="event-text">{event.text}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="faq-section wrap axis" id="faq" aria-labelledby="faq-title">
          <div className="slip pocket">
            <h2 className="printed" id="faq-title">Questions</h2>
            {QUESTIONS.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
          <p className="faq-aside">
            Something else? Call <a href="tel:+13125550148">(312) 555-0148</a> or ask at the main desk.
          </p>
        </section>

        <section className="card-section wrap axis" id="card" aria-labelledby="card-title">
          <CardForm />
          <div className="next">
            <h3>What happens next</h3>
            <ol className="next-steps">
              <li>We email your card number within one working day.</li>
              <li>Bring photo ID the first time you borrow a book.</li>
              <li>Use the number to borrow e-books straight away.</li>
            </ol>
          </div>
        </section>
      </main>

      <footer className="site-footer wrap axis">
        <p className="brand">Wrenfield Library</p>
        <div className="footer-details">
          <p>
            418 Harbor Road, Wrenfield
            <br />
            <a href="tel:+13125550148">(312) 555-0148</a>
            <br />
            <a href="mailto:hello@wrenfield-library.example">hello@wrenfield-library.example</a>
          </p>
          <p>Wrenfield Library is fictional. This page is a practice project for the DevConnect frontend track.</p>
        </div>
      </footer>
    </>
  );
}
