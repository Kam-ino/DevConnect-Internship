import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { ApiError, connect } from './lib/api.ts';
import { navigate, usePath } from './lib/router.tsx';
import { Mark } from './components/Brand.tsx';
import SignIn from './pages/SignIn.tsx';
import Library from './pages/Library.tsx';
import Workspace from './pages/Workspace.tsx';

export default function App() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [bootError, setBootError] = useState<ApiError | null>(null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const path = usePath();

  useEffect(() => {
    connect().then(setSb, (error: ApiError) => setBootError(error));
  }, []);

  useEffect(() => {
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  if (bootError) return <SetupNotice error={bootError} />;
  if (!sb || session === undefined) {
    return (
      <main className="splash" aria-busy="true">
        <Mark size={40} />
        <p role="status">Opening Stillroom…</p>
      </main>
    );
  }
  if (!session) return <SignIn sb={sb} />;

  const video = /^\/v\/([0-9a-f-]{36})\/?$/i.exec(path)?.[1];
  if (video) return <Workspace key={video} sb={sb} session={session} videoId={video} />;
  if (path !== '/') {
    navigate('/', { replace: true });
    return null;
  }
  return <Library sb={sb} session={session} />;
}

// The server is unreachable or not connected to Supabase: say which, and how to fix it.
function SetupNotice({ error }: { error: ApiError }) {
  const unconfigured = error.code === 'not_configured';
  return (
    <main className="notice">
      <Mark size={40} />
      <h1>{unconfigured ? 'Stillroom isn’t connected to Supabase yet' : 'Stillroom can’t reach its server'}</h1>
      <p role="alert">{error.message}</p>
      {unconfigured && (
        <ol>
          <li>Copy <code>.env.example</code> to <code>.env</code>.</li>
          <li>Fill in <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> from your project’s API settings.</li>
          <li>Restart the server, then reload this page.</li>
        </ol>
      )}
      <button className="button button-chalk" type="button" onClick={() => location.reload()}>Reload</button>
    </main>
  );
}
