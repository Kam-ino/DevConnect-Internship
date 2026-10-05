import { useState, type FormEvent } from 'react';
import type { AuthError, SupabaseClient } from '@supabase/supabase-js';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { clearSignedOutReason, signedOutReason } from '../lib/api.ts';
import { Wordmark } from '../components/Brand.tsx';
import StudyPlate from '../components/StudyPlate.tsx';

type Mode = 'sign-in' | 'sign-up';

// Supabase's auth errors, in words that say what to do next.
function explain(error: AuthError, mode: Mode): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'That email and password don’t match an account. Check them, or create an account.';
    case 'email_not_confirmed':
      return 'Confirm your email first: open the link we sent you, then sign in.';
    case 'user_already_exists':
    case 'email_exists':
      return 'There’s already an account with this email. Sign in instead.';
    case 'weak_password':
      return 'Choose a stronger password: at least 8 characters, not a common one.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts in a short time. Wait a minute, then try again.';
    case 'signup_disabled':
      return 'New accounts are switched off for this Stillroom project.';
    case 'validation_failed':
      return 'Enter a valid email address.';
  }
  if (error.name === 'AuthRetryableFetchError' || /fetch/i.test(error.message)) {
    return 'Couldn’t reach Supabase. Check your connection and try again.';
  }
  return mode === 'sign-in' ? `Sign-in failed: ${error.message}` : `Couldn’t create the account: ${error.message}`;
}

export default function SignIn({ sb }: { sb: SupabaseClient }) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(signedOutReason);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    clearSignedOutReason();
    if (mode === 'sign-up' && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        const { error: failure } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (failure) setError(explain(failure, mode));
      } else {
        const { data, error: failure } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin } });
        if (failure) setError(explain(failure, mode));
        else if (!data.session) {
          setNotice(`Check ${email.trim()} for a confirmation link, then come back and sign in.`);
          setMode('sign-in');
          setPassword('');
        }
      }
    } catch {
      setError('Couldn’t reach Supabase. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const switchTo = (next: Mode) => {
    setMode(next);
    setError('');
  };

  return (
    <div className="signin">
      <main className="signin-mount">
        <Wordmark />
        <h1>Motion, held still.</h1>
        <p className="lede">
          Stillroom breaks a video into its frames. Step to the exact one, keep it at full resolution, or export a numbered
          image sequence for the web.
        </p>

        <form className="auth" onSubmit={submit} aria-describedby={error ? 'auth-error' : undefined}>
          <div className="segmented" role="radiogroup" aria-label="Account">
            <button type="button" role="radio" aria-checked={mode === 'sign-in'} onClick={() => switchTo('sign-in')}>Sign in</button>
            <button type="button" role="radio" aria-checked={mode === 'sign-up'} onClick={() => switchTo('sign-up')}>Create account</button>
          </div>

          <label className="field">
            <span>Email</span>
            <input type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password{mode === 'sign-up' && <small> · at least 8 characters</small>}</span>
            <span className="password">
              <input
                type={reveal ? 'text' : 'password'}
                name="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'sign-up' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="icon-button" onClick={() => setReveal((v) => !v)} aria-label={reveal ? 'Hide password' : 'Show password'} aria-pressed={reveal}>
                {reveal ? <EyeSlash size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </span>
          </label>

          {error && <p className="form-error" id="auth-error" role="alert">{error}</p>}
          {notice && <p className="form-notice" role="status">{notice}</p>}

          <button className="button button-ink" type="submit" disabled={busy}>
            {busy ? (mode === 'sign-in' ? 'Signing in…' : 'Creating account…') : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </main>

      <aside className="signin-stage" aria-label="Example plate">
        <StudyPlate />
      </aside>
    </div>
  );
}
