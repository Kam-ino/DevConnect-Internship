import { useEffect, useRef, useState } from 'react';

const TITLE = 'Wrenfield Frontend Day';

const ATTENDANCE = {
  'in-person': 'In person at Harbor Hall',
  online: 'Online, on the live stream',
};

// Each rule returns an error message, or '' when the field is fine.
// `target` is the input the error summary link moves focus to.
const RULES = [
  {
    name: 'fullName',
    target: 'fullName',
    check: (f) => (f.fullName.value.trim() ? '' : 'Enter your full name'),
  },
  {
    name: 'email',
    target: 'email',
    check: (f) =>
      !f.email.value.trim() ? 'Enter your email address'
        : f.email.validity.typeMismatch ? 'Enter an email address like name@example.com'
          : '',
  },
  {
    name: 'attendance',
    target: 'attendance-person',
    check: (f) => (f.attendance.value ? '' : 'Choose how you will attend'),
  },
];

const formatDate = (date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function RegisterForm() {
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [registered, setRegistered] = useState(null);
  const summaryRef = useRef(null);
  const headingRef = useRef(null);
  const wasRegistered = useRef(false);
  const failed = RULES.filter((rule) => errors[rule.name]);

  useEffect(() => {
    document.title = failed.length ? `Error: ${TITLE}` : TITLE;
  }, [failed.length]);

  // Every failed submit moves focus to the summary, even when the errors haven't changed.
  useEffect(() => {
    if (attempt) summaryRef.current.focus();
  }, [attempt]);

  // The form is swapped for the badge (and back), so focus follows rather than falling to the page.
  useEffect(() => {
    if (registered) headingRef.current.focus();
    else if (wasRegistered.current) document.getElementById('fullName').focus();
    wasRegistered.current = Boolean(registered);
  }, [registered]);

  function handleSubmit(event) {
    event.preventDefault();
    const f = event.currentTarget.elements;
    const next = Object.fromEntries(RULES.map((rule) => [rule.name, rule.check(f)]));
    setErrors(next);

    if (RULES.some((rule) => next[rule.name])) {
      setAttempt((n) => n + 1);
      return;
    }

    // Front end only: nothing is sent anywhere.
    setRegistered({
      name: f.fullName.value.trim(),
      email: f.email.value.trim(),
      attendance: f.attendance.value,
      date: new Date(),
    });
  }

  // Following a #link doesn't move focus into an input in every browser, so do it here.
  function focusField(event, id) {
    event.preventDefault();
    const input = document.getElementById(id);
    input.closest('.field').scrollIntoView();
    input.focus({ preventScroll: true });
  }

  const invalid = (name) => (errors[name] ? 'true' : undefined);

  return (
    <div className="slip badge-card">
      <h2 className="printed" id="register-title" ref={headingRef} tabIndex={-1}>
        {registered ? 'Your badge' : 'Register for a free place'}
      </h2>

      {/* Always rendered, so screen readers announce the message when it fills in */}
      <p className="form-status" role="status">
        {registered && `Thanks, you're registered. We'll email your confirmation to ${registered.email} within a day.`}
      </p>

      {registered ? (
        <>
          <div className="badge">
            <p className="printed-head">Wrenfield Frontend Day</p>
            <p className="badge-name">{registered.name}</p>
            <p className="badge-mode">{ATTENDANCE[registered.attendance]}</p>
            <p className="badge-date">Thursday 15 October 2026</p>
            <p className="stamp registered-stamp press" key={registered.date.getTime()} aria-hidden="true">
              <span>Registered</span>
              <span className="registered-date">{formatDate(registered.date)}</span>
            </p>
          </div>
          <button className="button button-quiet" type="button" onClick={() => setRegistered(null)}>
            Register someone else
          </button>
        </>
      ) : (
        <>
          <p>It takes about a minute.</p>

          {failed.length > 0 && (
            <div className="error-summary" ref={summaryRef} tabIndex={-1}>
              <h3>There is a problem</h3>
              <ul>
                {failed.map((rule) => (
                  <li key={rule.name}>
                    <a href={`#${rule.target}`} onClick={(event) => focusField(event, rule.target)}>
                      {errors[rule.name]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form noValidate onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" name="fullName" type="text" autoComplete="name" required
                aria-invalid={invalid('fullName')} aria-describedby="fullName-error" />
              <p className="error" id="fullName-error">{errors.fullName}</p>
            </div>

            <div className="field">
              <label htmlFor="email">Email address</label>
              <p className="hint" id="email-hint">We'll send your confirmation here.</p>
              <input id="email" name="email" type="email" autoComplete="email" spellCheck="false" required
                aria-invalid={invalid('email')} aria-describedby="email-hint email-error" />
              <p className="error" id="email-error">{errors.email}</p>
            </div>

            <fieldset className="field" aria-describedby="attendance-error">
              <legend>How will you attend?</legend>
              <div className="choice">
                <input id="attendance-person" name="attendance" type="radio" value="in-person" required aria-invalid={invalid('attendance')} />
                <label htmlFor="attendance-person">{ATTENDANCE['in-person']}</label>
              </div>
              <div className="choice">
                <input id="attendance-online" name="attendance" type="radio" value="online" aria-invalid={invalid('attendance')} />
                <label htmlFor="attendance-online">{ATTENDANCE.online}</label>
              </div>
              <p className="error" id="attendance-error">{errors.attendance}</p>
            </fieldset>

            <div className="field">
              <label htmlFor="access">Access needs <span className="optional">(optional)</span></label>
              <p className="hint" id="access-hint">Tell us anything that would help, like seating, captions or dietary needs.</p>
              <textarea id="access" name="access" rows={3} aria-describedby="access-hint" />
            </div>

            <div className="choice">
              <input id="slides" name="slides" type="checkbox" />
              <label htmlFor="slides">Email me the slides after the event</label>
            </div>

            <div>
              <button className="button" type="submit">Register</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
