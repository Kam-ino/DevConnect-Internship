import ProgrammeSlip from './ProgrammeSlip.jsx';
import Schedule from './Schedule.jsx';
import RegisterForm from './RegisterForm.jsx';
import readingRoom from './assets/reading-room.jpg';

const QUESTIONS = [
  {
    q: 'Does it cost anything?',
    a: "No. Places are free, in person and online. We ask you to register so we know how many seats and lunches to plan for.",
  },
  {
    q: 'Are the talks accessible?',
    a: 'Every talk has live captions on screen and in the stream. Hall A has a hearing loop and a sign language interpreter, and slides are shared the day before.',
  },
  {
    q: 'Is the venue step-free?',
    a: 'Yes. The Harbor Road entrance is step-free, lifts reach both floors, and there are accessible toilets and a quiet room on each floor.',
  },
  {
    q: 'Can I come for part of the day?',
    a: 'Yes. Come for the talks you want. Your registration covers the whole day, and you can leave and come back.',
  },
];

// Reviewers can preview any moment of the day, for example ?now=2026-10-15T10:40
function currentTime() {
  const param = new URLSearchParams(window.location.search).get('now');
  const preview = param ? new Date(param) : null;
  return preview && !Number.isNaN(preview.getTime()) ? { now: preview, preview: true } : { now: new Date(), preview: false };
}

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
  const { now, preview } = currentTime();

  return (
    <>
      <InkFilter />
      <a className="skip-link" href="#main">Skip to main content</a>

      <header className="site-header wrap">
        <a className="brand" href="./">Wrenfield Frontend Day</a>
        <nav aria-label="Main">
          <ul className="nav" role="list">
            <li><a href="#schedule">Schedule</a></li>
            <li><a href="#venue">Venue</a></li>
            <li><a href="#faq">Questions</a></li>
            <li><a href="#register">Register</a></li>
          </ul>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="hero wrap axis" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">Wrenfield Frontend Day</h1>
            <p className="lede">A free one-day conference on building accessible websites. Thursday 15 October at Harbor Hall, or online.</p>
            <a className="button" href="#register">Register</a>
          </div>
          <ProgrammeSlip now={now} preview={preview} />
        </section>

        <section className="schedule-section wrap axis" id="schedule" aria-labelledby="schedule-title">
          <div className="section-intro">
            <h2 id="schedule-title">Schedule</h2>
            <p>Hall A and Hall B run side by side between the keynote and the closing panel. Every talk is captioned.</p>
          </div>
          <div className="slip schedule-card">
            <Schedule now={now} />
          </div>
        </section>

        <div className="venue-faq wrap axis">
          <section id="venue" aria-labelledby="venue-title">
            <img className="plate" src={readingRoom} width="1200" height="900" loading="lazy"
              alt="People working at long tables in a reading room with floor-to-ceiling windows." />
            <h2 id="venue-title">Venue</h2>
            <address>Harbor Hall, 418 Harbor Road, Wrenfield</address>
            <p>Buses 12 and 40 stop outside. Bike racks are by the side entrance, and the main entrance is step-free.</p>
          </section>

          <section className="slip questions" id="faq" aria-labelledby="faq-title">
            <h2 className="printed" id="faq-title">Questions</h2>
            {QUESTIONS.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
            <p className="questions-foot">
              Something else? Email <a href="mailto:hello@wrenfield-frontend.example">hello@wrenfield-frontend.example</a>.
            </p>
          </section>
        </div>

        <section className="register-section wrap axis" id="register" aria-labelledby="register-title">
          <RegisterForm />
          <div className="next">
            <h3>What happens next</h3>
            <ol className="next-steps">
              <li>We email your confirmation within a day.</li>
              <li>In person: show the email at the door, on your phone or printed.</li>
              <li>Online: the stream link arrives on the morning of the event.</li>
            </ol>
          </div>
        </section>
      </main>

      <footer className="site-footer wrap axis">
        <p className="brand">Wrenfield Frontend Day</p>
        <div className="footer-details">
          <p>
            Harbor Hall, 418 Harbor Road, Wrenfield
            <br />
            <a href="mailto:hello@wrenfield-frontend.example">hello@wrenfield-frontend.example</a>
          </p>
          <p>Wrenfield Frontend Day is fictional. This page is a practice project for the DevConnect frontend track.</p>
        </div>
      </footer>
    </>
  );
}
