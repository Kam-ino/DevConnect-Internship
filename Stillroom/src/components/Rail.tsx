// The plate-mount rail: the app's navigation, in buff, down the left edge (across the top on phones).
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { FilmStrip, SignOut, UploadSimple } from '@phosphor-icons/react';
import { Link } from '../lib/router.tsx';
import { Mark } from './Brand.tsx';

interface RailProps {
  sb: SupabaseClient;
  session: Session;
  current: 'library' | 'workspace';
  onUpload?: () => void;
  uploadDisabled?: boolean;
}

export default function Rail({ sb, session, current, onUpload, uploadDisabled = false }: RailProps) {
  return (
    <nav className="rail" aria-label="Stillroom">
      <Link to="/" className="rail-home" aria-label="Stillroom, library">
        <Mark size={30} />
      </Link>
      <ul className="rail-items" role="list">
        <li>
          <Link to="/" className="rail-item" aria-current={current === 'library' ? 'page' : undefined}>
            <FilmStrip aria-hidden="true" size={22} />
            <span>Library</span>
          </Link>
        </li>
        {onUpload && (
          <li>
            <button type="button" className="rail-item" onClick={onUpload} disabled={uploadDisabled} title={uploadDisabled ? 'Your library is full: delete a video to add another' : undefined}>
              <UploadSimple aria-hidden="true" size={22} />
              <span>Upload</span>
            </button>
          </li>
        )}
      </ul>
      <div className="rail-account">
        <span className="rail-email" title={session.user.email}>{session.user.email}</span>
        <button type="button" className="rail-item" onClick={() => void sb.auth.signOut({ scope: 'local' })}>
          <SignOut aria-hidden="true" size={22} />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
}
