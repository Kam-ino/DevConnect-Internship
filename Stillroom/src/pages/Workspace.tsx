import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PostgrestError, Session, SupabaseClient } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, BookmarkSimple, CaretDoubleLeft, CaretDoubleRight, CaretLeft, CaretRight, DownloadSimple, GridFour, SkipBack, SkipForward,
} from '@phosphor-icons/react';
import { LIMITS, clampFrame, formatDuration, timecode, type ImageFormat } from '../../shared/frames.ts';
import type { KeptFrame, VideoRow } from '../../shared/types.ts';
import { ApiError, download } from '../lib/api.ts';
import { useAssets } from '../lib/media.ts';
import { Link, navigate } from '../lib/router.tsx';
import Rail from '../components/Rail.tsx';
import Inspector from '../components/Inspector.tsx';
import ContactSheet from '../components/ContactSheet.tsx';
import KeptPanel from '../components/KeptPanel.tsx';
import ExportPanel, { type Range } from '../components/ExportPanel.tsx';
import Scale from '../components/Scale.tsx';

// three.js is large, so the rack loads only when someone opens it.
const PlateRack = lazy(() => import('../components/PlateRack.tsx'));

type Load = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; video: VideoRow };
type View = 'sheet' | 'rack';
interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

const KEPT_COLUMNS = 'id, video_id, frame_index, label, created_at';

function explainDb(error: PostgrestError | null): string {
  const message = error?.message ?? '';
  if (message.includes('kept_limit')) return 'A video keeps at most 600 frames. Remove some kept frames first.';
  if (message.includes('frame_out_of_range')) return 'That frame isn’t in this video.';
  if (/fetch|network/i.test(message)) return 'Couldn’t reach Supabase. Check your connection and try again.';
  return `Supabase refused the change${message ? `: ${message}` : ''}.`;
}

const savedView = (): View => {
  try {
    return localStorage.getItem('stillroom:view') === 'rack' ? 'rack' : 'sheet';
  } catch {
    return 'sheet';
  }
};

export default function Workspace({ sb, session, videoId }: { sb: SupabaseClient; session: Session; videoId: string }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [kept, setKept] = useState<KeptFrame[]>([]);
  const [frame, setFrame] = useState(() => Math.max(0, Number(new URLSearchParams(location.search).get('f')) || 0));
  const [view, setView] = useState<View>(savedView);
  const [grid, setGrid] = useState(0);
  const [divisions, setDivisions] = useState(10);
  const [range, setRange] = useState<Range>({ start: 0, end: 0 });
  const [attempt, setAttempt] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [plate, setPlate] = useState<number | null>(null);
  const noticeId = useRef(0);
  // The latest frame and kept list, readable before React re-renders, so key repeat never steps
  // from a stale frame; and the frames whose keep/un-keep is still saving.
  const frameRef = useRef(frame);
  const keptRef = useRef<KeptFrame[]>([]);
  keptRef.current = kept;
  const pending = useRef(new Set<number>());

  const video = load.status === 'ready' ? load.video : null;
  const assets = useAssets(sb, video, attempt);

  const say = useCallback((text: string, tone: Notice['tone'] = 'info') => {
    const id = ++noticeId.current;
    setNotices((list) => [...list.slice(-2), { id, text, tone }]);
    setTimeout(() => setNotices((list) => list.filter((n) => n.id !== id)), tone === 'error' ? 8000 : 4000);
  }, []);

  // ---- Load the video (and follow it while it processes) ----
  const fetchVideo = useCallback(async () => {
    const { data, error } = await sb.from('videos').select('*').eq('id', videoId).maybeSingle();
    if (error) return setLoad((current) => (current.status === 'ready' ? current : { status: 'error', message: 'Couldn’t load this video from Supabase. Check your connection and try again.' }));
    if (!data) return setLoad({ status: 'missing' });
    const row = data as VideoRow;
    setLoad({ status: 'ready', video: row });
    frameRef.current = clampFrame(frameRef.current, row.frame_count);
    setFrame(frameRef.current);
    setRange((r) => (r.end ? r : { start: 0, end: Math.min(row.frame_count - 1, LIMITS.maxExportFrames - 1) }));
    // Plates are numbered in upload order, like plates in a printed series.
    const { count } = await sb.from('videos').select('id', { count: 'exact', head: true }).lt('created_at', row.created_at);
    if (count !== null) setPlate(count + 1);
  }, [sb, videoId]);

  useEffect(() => {
    void fetchVideo();
  }, [fetchVideo]);

  useEffect(() => {
    if (video?.status !== 'processing') return;
    const timer = setInterval(() => void fetchVideo(), 2000);
    return () => clearInterval(timer);
  }, [video?.status, fetchVideo]);

  const loadKept = useCallback(async () => {
    const { data, error } = await sb.from('kept_frames').select(KEPT_COLUMNS).eq('video_id', videoId).order('frame_index');
    if (error) say('Couldn’t load your kept frames. They’re safe; reload to try again.', 'error');
    else setKept(data as KeptFrame[]);
  }, [sb, videoId, say]);

  useEffect(() => {
    if (video?.status === 'ready') void loadKept();
  }, [video?.status, loadKept]);

  // ---- The current frame: in the address (so a reload keeps it) and announced politely ----
  useEffect(() => {
    if (!video) return;
    const timer = setTimeout(() => {
      history.replaceState(null, '', `/v/${video.id}?f=${frame}`);
      setAnnouncement(`Frame ${frame} of ${video.frame_count - 1}, ${timecode(frame, video.fps)}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [video, frame]);

  const go = useCallback((next: number) => {
    if (!video) return;
    frameRef.current = clampFrame(next, video.frame_count);
    setFrame(frameRef.current);
  }, [video]);
  const step = useCallback((delta: number) => go(frameRef.current + delta), [go]);

  const keptFrames = useMemo(() => new Set(kept.map((k) => k.frame_index)), [kept]);
  const current = kept.find((k) => k.frame_index === frame);
  const byFrame = (a: KeptFrame, b: KeptFrame) => a.frame_index - b.frame_index;

  // Keep a frame, or un-keep it when it's already kept. One change per frame at a time; the list
  // never holds a frame twice.
  async function keep(at: number) {
    if (!video || pending.current.has(at)) return;
    const existing = keptRef.current.find((k) => k.frame_index === at);
    if (existing) return unkeep(existing);
    pending.current.add(at);
    try {
      const temp: KeptFrame = { id: `pending-${at}`, video_id: video.id, frame_index: at, label: null, created_at: new Date().toISOString() };
      setKept((list) => [...list.filter((k) => k.frame_index !== at), temp].sort(byFrame));
      const { data, error } = await sb.from('kept_frames').insert({ video_id: video.id, frame_index: at }).select(KEPT_COLUMNS).single();
      if (error) {
        if (error.code === '23505') return void (await loadKept()); // already kept, from another tab
        setKept((list) => list.filter((k) => k.id !== temp.id));
        return say(explainDb(error), 'error');
      }
      setKept((list) => [...list.filter((k) => k.frame_index !== at), data as KeptFrame].sort(byFrame));
      say(`Frame ${at} kept.`);
    } finally {
      pending.current.delete(at);
    }
  }

  async function unkeep(item: KeptFrame) {
    if (pending.current.has(item.frame_index)) return;
    pending.current.add(item.frame_index);
    try {
      setKept((list) => list.filter((k) => k.frame_index !== item.frame_index));
      const { error } = await sb.from('kept_frames').delete().eq('id', item.id);
      if (error) {
        setKept((list) => [...list.filter((k) => k.frame_index !== item.frame_index), item].sort(byFrame));
        return say(explainDb(error), 'error');
      }
      say(`Frame ${item.frame_index} removed from kept frames.`);
    } finally {
      pending.current.delete(item.frame_index);
    }
  }

  async function label(item: KeptFrame, text: string) {
    const { error } = await sb.from('kept_frames').update({ label: text || null }).eq('id', item.id);
    if (error) throw new Error(explainDb(error));
    setKept((list) => list.map((k) => (k.id === item.id ? { ...k, label: text || null } : k)));
  }

  async function downloadFrame(at: number, format: ImageFormat) {
    if (!video) return;
    say(`Extracting frame ${at} at full size…`);
    try {
      await download(sb, `/api/videos/${video.id}/frames/${at}?format=${format}&download=1`, `frame-${at}.${format}`);
    } catch (error) {
      say(`Couldn’t download frame ${at}. ${(error as ApiError).message}`, 'error');
    }
  }

  function switchView(next: View) {
    setView(next);
    try {
      localStorage.setItem('stillroom:view', next);
    } catch {
      // private mode: the choice just isn't remembered
    }
  }

  // ---- Keyboard: arrows step, K keeps, G grid, I/O set the export range ----
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event) => {
    if (!video || video.status !== 'ready') return;
    const target = event.target as HTMLElement;
    if (target.closest('input, select, textarea, [contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey) return;
    const by = event.shiftKey ? 10 : 1;
    const at = frameRef.current;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => step(-by),
      ArrowRight: () => step(by),
      Home: () => go(0),
      End: () => go(video.frame_count - 1),
      k: () => void keep(at),
      g: () => setGrid((g) => (g ? 0 : divisions)),
      i: () => setRange((r) => ({ ...r, start: at })),
      o: () => setRange((r) => ({ ...r, end: at })),
    };
    const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keys.current(event);
    addEventListener('keydown', listener);
    return () => removeEventListener('keydown', listener);
  }, []);

  // ---- Rendering ----
  const shell = (content: ReactNode) => (
    <div className="app">
      <Rail sb={sb} session={session} current="workspace" onUpload={() => navigate("/?upload")} />
      <main className="workspace" id="main">{content}</main>
    </div>
  );

  if (load.status === 'loading') {
    return shell(<p className="workspace-message" role="status">Loading the plate…</p>);
  }
  if (load.status === 'missing') {
    return shell(
      <div className="workspace-message">
        <h1>No video here</h1>
        <p>This video doesn’t exist, or it belongs to another account.</p>
        <Link to="/" className="button button-chalk">Back to the library</Link>
      </div>,
    );
  }
  if (load.status === 'error') {
    return shell(
      <div className="workspace-message" role="alert">
        <h1>Couldn’t open this video</h1>
        <p>{load.message}</p>
        <button className="button button-chalk" type="button" onClick={() => void fetchVideo()}>Try again</button>
      </div>,
    );
  }

  const v = load.video;
  if (v.status !== 'ready') {
    return shell(
      <div className="workspace-message">
        <h1>{v.title}</h1>
        {v.status === 'processing' ? (
          <>
            <p role="status">Printing the contact sheet · <span className="figures">{Math.round(v.progress * 100)}%</span></p>
            <Scale value={v.progress} label="Processing" />
          </>
        ) : (
          <p role="alert">{v.error ?? 'Processing failed.'} You can retry it from the library.</p>
        )}
        <Link to="/" className="button button-quiet">Back to the library</Link>
      </div>,
    );
  }

  const meta = [
    `${v.frame_count.toLocaleString('en')} frames`,
    `${Math.round(v.fps * 100) / 100} fps`,
    `${v.width}×${v.height}`,
    formatDuration(v.duration_s),
    ...(v.sample_step > 1 ? [`sheet shows every ${v.sample_step}th frame`] : []),
  ].join(' · ');
  const exactTime = assets.status === 'ready' ? assets.times[frame] : undefined;

  return (
    <div className="app">
      <Rail sb={sb} session={session} current="workspace" onUpload={() => navigate("/?upload")} />
      <main className="workspace" id="main">
        <header className="caption-bar">
          <Link to="/" className="back"><ArrowLeft size={18} aria-hidden="true" /> Library</Link>
          <div className="caption">
            <h1>{plate && <span className="plate-no">Plate {plate}</span>} {v.title}</h1>
            <p className="meta">{meta}</p>
          </div>
          <div className="segmented" role="radiogroup" aria-label="View">
            <button type="button" role="radio" aria-checked={view === 'sheet'} onClick={() => switchView('sheet')}>Contact sheet</button>
            <button type="button" role="radio" aria-checked={view === 'rack'} onClick={() => switchView('rack')}>Plate rack</button>
          </div>
        </header>

        <div className="workspace-grid">
          <section className="stage-col" aria-label="Frame inspector">
            {assets.status === 'error' ? (
              <div className="panel-error" role="alert">
                <p>{assets.message}</p>
                <button className="button button-quiet" type="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
              </div>
            ) : (
              <Inspector sb={sb} video={v} sheets={assets.status === 'ready' ? assets.sheets : []} frame={frame} grid={grid} />
            )}

            <div className="transport" role="toolbar" aria-label="Frame controls">
              <div className="transport-steps">
                <button className="icon-button" type="button" onClick={() => go(0)} aria-label="First frame (Home)"><SkipBack size={20} aria-hidden="true" /></button>
                <button className="icon-button" type="button" onClick={() => step(-10)} aria-label="Back 10 frames (Shift+Left)"><CaretDoubleLeft size={20} aria-hidden="true" /></button>
                <button className="icon-button" type="button" onClick={() => step(-1)} aria-label="Previous frame (Left)"><CaretLeft size={20} aria-hidden="true" /></button>
                <FrameInput frame={frame} last={v.frame_count - 1} onGo={go} />
                <button className="icon-button" type="button" onClick={() => step(1)} aria-label="Next frame (Right)"><CaretRight size={20} aria-hidden="true" /></button>
                <button className="icon-button" type="button" onClick={() => step(10)} aria-label="Forward 10 frames (Shift+Right)"><CaretDoubleRight size={20} aria-hidden="true" /></button>
                <button className="icon-button" type="button" onClick={() => go(v.frame_count - 1)} aria-label="Last frame (End)"><SkipForward size={20} aria-hidden="true" /></button>
              </div>
              <p className="readout figures">
                <span>{timecode(frame, v.fps)}</span>
                {exactTime !== undefined && <span className="dim">{exactTime.toFixed(3)} s</span>}
              </p>
              <div className="transport-tools">
                <button className={`button ${current ? 'button-mount' : 'button-chalk'}`} type="button" aria-pressed={Boolean(current)} onClick={() => void keep(frame)}>
                  <BookmarkSimple size={18} weight={current ? 'fill' : 'regular'} aria-hidden="true" /> {current ? 'Kept' : 'Keep frame'}
                </button>
                <button className="chip" type="button" onClick={() => void downloadFrame(frame, 'png')}><DownloadSimple size={16} aria-hidden="true" /> PNG</button>
                <button className="chip" type="button" onClick={() => void downloadFrame(frame, 'webp')}><DownloadSimple size={16} aria-hidden="true" /> WebP</button>
                <span className="grid-tools">
                <button className="icon-button" type="button" aria-pressed={grid > 0} onClick={() => setGrid((g) => (g ? 0 : divisions))} aria-label="Measuring grid (G)">
                  <GridFour size={20} aria-hidden="true" />
                </button>
                <label className="visually-hidden" htmlFor="divisions">Grid divisions</label>
                <select id="divisions" value={divisions} onChange={(e) => {
                  setDivisions(Number(e.target.value));
                  setGrid((g) => (g ? Number(e.target.value) : g));
                }}>
                  {[4, 8, 10, 12, 16].map((n) => <option key={n} value={n}>{n} × {n}</option>)}
                </select>
                </span>
              </div>
            </div>

            {assets.status === 'ready' && (view === 'sheet'
              ? <ContactSheet video={v} sheets={assets.sheets} frame={frame} kept={keptFrames} range={range} onSelect={go} />
              : <Suspense fallback={<div className="rack" aria-busy="true" aria-label="Loading the plate rack" />}><PlateRack video={v} sheets={assets.sheets} frame={frame} kept={keptFrames} onSelect={go} /></Suspense>)}
            {assets.status === 'loading' && <div className="sheet-loading" aria-busy="true" aria-label="Loading the contact sheet" />}
          </section>

          <aside className="side-col" aria-label="Kept frames and export">
            <KeptPanel
              sb={sb} video={v} sheets={assets.status === 'ready' ? assets.sheets : []} kept={kept} frame={frame}
              onGo={go} onRemove={(item) => void unkeep(item)} onLabel={label} onDownload={(at, f) => void downloadFrame(at, f)} say={say}
            />
            <ExportPanel sb={sb} video={v} frame={frame} range={range} onRange={setRange} say={say} />
            <details className="side-panel keys">
              <summary>Keyboard</summary>
              <dl>
                <div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Previous or next frame</dd></div>
                <div><dt><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd></dt><dd>Ten frames</dd></div>
                <div><dt><kbd>Home</kbd> <kbd>End</kbd></dt><dd>First or last frame</dd></div>
                <div><dt><kbd>K</kbd></dt><dd>Keep or un-keep this frame</dd></div>
                <div><dt><kbd>G</kbd></dt><dd>Measuring grid</dd></div>
                <div><dt><kbd>I</kbd> <kbd>O</kbd></dt><dd>Sequence start or end at this frame</dd></div>
              </dl>
            </details>
          </aside>
        </div>
        <p className="visually-hidden" aria-live="polite">{announcement}</p>
      </main>

      <div className="notices">
        <AnimatePresence>
          {notices.map((notice) => (
            <motion.p
              key={notice.id}
              className={`notice-item is-${notice.tone}`}
              role={notice.tone === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {notice.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Type a frame number and press Enter to go there.
function FrameInput({ frame, last, onGo }: { frame: number; last: number; onGo: (frame: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) onGo(Number(draft));
    setDraft(null);
  };
  return (
    <label className="frame-input">
      <span className="visually-hidden">Frame number, 0 to {last}</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft ?? String(frame)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
      <span className="figures dim" aria-hidden="true">/ {last}</span>
    </label>
  );
}
