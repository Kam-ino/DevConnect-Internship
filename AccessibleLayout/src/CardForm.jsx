import { useEffect, useRef, useState } from 'react';

const TITLE = 'Wrenfield Library';

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
    name: 'cardType',
    target: 'cardType-adult',
    check: (f) => (f.cardType.value ? '' : 'Choose which card you need'),
  },
];

const formatDate = (date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CardForm() {
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [issued, setIssued] = useState(null);
  const summaryRef = useRef(null);
  const failed = RULES.filter((rule) => errors[rule.name]);

  useEffect(() => {
    document.title = failed.length ? `Error: ${TITLE}` : TITLE;
  }, [failed.length]);

  // Every failed submit moves focus to the summary, even when the errors haven't changed.
  useEffect(() => {
    if (attempt) summaryRef.current.focus();
  }, [attempt]);

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const next = Object.fromEntries(RULES.map((rule) => [rule.name, rule.check(form.elements)]));
    setErrors(next);

    if (RULES.some((rule) => next[rule.name])) {
      setIssued(null);
      setAttempt((n) => n + 1);
      return;
    }

    // Front end only: nothing is sent anywhere.
    setIssued({ email: form.elements.email.value.trim(), date: new Date() });
    form.reset();
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
    <div className="slip borrower-card">
      <h2 className="printed" id="card-title">Get a library card</h2>
      <p>It's free and takes about two minutes.</p>

      {issued && (
        <p className="stamp issued-stamp press" key={issued.date.getTime()} aria-hidden="true">
          <span>Issued</span>
          <span className="issued-date">{formatDate(issued.date)}</span>
        </p>
      )}

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

      <p className="form-status" role="status">
        {issued && `Thanks, your application is in. We'll email your card number to ${issued.email} within one working day.`}
      </p>

      <form noValidate onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input id="fullName" name="fullName" type="text" autoComplete="name" required
            aria-invalid={invalid('fullName')} aria-describedby="fullName-error" />
          <p className="error" id="fullName-error">{errors.fullName}</p>
        </div>

        <div className="field">
          <label htmlFor="email">Email address</label>
          <p className="hint" id="email-hint">We'll send your card number here.</p>
          <input id="email" name="email" type="email" autoComplete="email" spellCheck="false" required
            aria-invalid={invalid('email')} aria-describedby="email-hint email-error" />
          <p className="error" id="email-error">{errors.email}</p>
        </div>

        <fieldset className="field" aria-describedby="cardType-error">
          <legend>Which card do you need?</legend>
          <div className="choice">
            <input id="cardType-adult" name="cardType" type="radio" value="adult" required aria-invalid={invalid('cardType')} />
            <label htmlFor="cardType-adult">Adult, 16 and over</label>
          </div>
          <div className="choice">
            <input id="cardType-child" name="cardType" type="radio" value="child" aria-invalid={invalid('cardType')} />
            <label htmlFor="cardType-child">Child, under 16</label>
          </div>
          <p className="error" id="cardType-error">{errors.cardType}</p>
        </fieldset>

        <div className="choice">
          <input id="newsletter" name="newsletter" type="checkbox" />
          <label htmlFor="newsletter">Email me the monthly events list</label>
        </div>

        <div>
          <button className="button" type="submit">Apply for a card</button>
        </div>
      </form>
    </div>
  );
}
