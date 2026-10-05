import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowClockwise, Trash, UploadSimple, WarningOctagon } from '@phosphor-icons/react';
import { LIMITS, formatBytes, formatDuration } from '../../shared/frames.ts';
import type { VideoRow } from '../../shared/types.ts';
import { ApiError, request, uploadVideo, type Upload } from '../lib/api.ts';
import { posterUrls } from '../lib/media.ts';
import { Link } from '../lib/router.tsx';
import Rail from '../components/Rail.tsx';
import Thumb from '../components/Thumb.tsx';
import Scale from '../components/Scale.tsx';

const ACCEPT = 'video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv';
const STALLED_AFTER = 2 * 60_000; // a processing row that hasn't moved for this long was interrupted

type List =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; videos: VideoRow[] };

type Sending =
  | { phase: 'idle' }
  | { phase: 'sending'; file: File; sent: number }
  | { phase: 'saving'; file: File }
  | { phase: 'failed'; file: File | null; message: string };

const stalled = (video: VideoRow) => video.status === 'processing' && Date.now() - Date.parse(video.updated_at) > STALLED_AFTER;

export default function Library({ sb, session }: { sb: SupabaseClient; session: Session }) {
  const [list, setList] = useState<List>({ status: 'loading' });
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Sending>({ phase: 'idle' });
  const [dragging, setDragging] = useState(false);
  const [announce, setAnnounce] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const upload = useRef<Upload | null>(null);
  const signed = useRef(new Set<string>()); // videos whose poster URL is already signed

  const load = useCallback(async () => {
    const { data, error } = await sb.from('videos').select('*').order('created_at', { ascending: false });
    if (error) {
      // A failed refresh keeps the list on screen; only a failed first load shows the error.
      setList((current) => (current.status === 'ready' ? current : { status: 'error', message: 'Couldn’t load your videos from Supabase. Check your connection and try again.' }));
      return;
    }
    const videos = data as VideoRow[];
    setList({ status: 'ready', videos });
    const urls = await posterUrls(sb, videos.filter((v) => !signed.current.has(v.id)));
    Object.keys(urls).forEach((id) => signed.current.add(id));
    if (Object.keys(urls).length) setPosters((current) => ({ ...current, ...urls }));
  }, [sb]);

  useEffect(() => {
    void load();
  }, [load]);

  // While anything is processing, follow its progress.
  const processing = list.status === 'ready' && list.videos.some((v) => v.status === 'processing' && !stalled(v));
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [processing, load]);

  useEffect(() => () => upload.current?.abort(), []);

  const count = list.status === 'ready' ? list.videos.length : 0;

  function start(file: File | undefined) {
    if (!file) return;
    if (count >= LIMITS.maxVideos) {
      return setSending({ phase: 'failed', file: null, message: `You already have ${LIMITS.maxVideos} videos, the most an account can hold. Delete one to upload another.` });
    }
    if (file.size > LIMITS.maxBytes) {
      return setSending({ phase: 'failed', file: null, message: `${file.name} is ${formatBytes(file.size)}. Stillroom takes videos up to 50 MB; compress or trim it and try again.` });
    }
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv)$/i.test(file.name)) {
      return setSending({ phase: 'failed', file: null, message: `${file.name} isn’t a video. Choose an MP4, MOV, WebM or MKV file.` });
    }
    setSending({ phase: 'sending', file, sent: 0 });
    // Once every byte is sent, the server is probing the file and storing it.
    const job = uploadVideo(sb, file, (sent) => setSending((s) => (s.phase !== 'sending' ? s : sent >= 1 ? { phase: 'saving', file } : { ...s, sent })));
    upload.current = job;
    job.promise.then(
      (video) => {
        upload.current = null;
        setSending({ phase: 'idle' });
        setAnnounce(`${video.title} uploaded. Printing its contact sheet.`);
        setList((current) => (current.status === 'ready' ? { status: 'ready', videos: [video, ...current.videos] } : current));
      },
      (error: ApiError) => {
        upload.current = null;
        if (error.code === 'aborted') return setSending({ phase: 'idle' });
        setSending({ phase: 'failed', file, message: error.message });
      },
    );
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (sending.phase === 'sending' || sending.phase === 'saving') return;
    start(event.dataTransfer.files[0]);
  };

  async function retry(video: VideoRow) {
    try {
      await request(sb, `/api/videos/${video.id}/retry`, { method: 'POST' });
      setAnnounce(`Processing ${video.title} again.`);
      await load();
    } catch (error) {
      setAnnounce((error as ApiError).message);
    }
  }

  async function remove(video: VideoRow) {
    await request(sb, `/api/videos/${video.id}`, { method: 'DELETE' });
    setAnnounce(`${video.title} deleted.`);
    setList((current) => (current.status === 'ready' ? { status: 'ready', videos: current.videos.filter((v) => v.id !== video.id) } : current));
  }

  const busy = sending.phase === 'sending' || sending.phase === 'saving';

  return (
    <div className="app">
      <Rail sb={sb} session={session} current="library" onUpload={() => picker.current?.click()} />
      <main className="library" id="main">
        <header className="library-head">
          <h1>Library</h1>
          {list.status === 'ready' && (
            <p className="usage">
              <span className="figures">{count}</span> of <span className="figures">{LIMITS.maxVideos}</span> videos
            </p>
          )}
        </header>

        <section
          className={`dropzone${dragging ? ' is-dragging' : ''}${count === 0 && list.status === 'ready' ? ' is-empty' : ''}`}
          aria-labelledby="upload-title"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input ref={picker} type="file" accept={ACCEPT} hidden onChange={(e) => {
            start(e.target.files?.[0]);
            e.target.value = '';
          }} />
          {sending.phase === 'idle' || sending.phase === 'failed' ? (
            <>
              <h2 id="upload-title">{count === 0 && list.status === 'ready' ? 'Your library is empty. Drop in your first video.' : 'Add a video'}</h2>
              <p>MP4, MOV, WebM or MKV · up to 50 MB · up to 5 minutes</p>
              <button className="button button-chalk" type="button" onClick={() => picker.current?.click()}>
                <UploadSimple size={20} aria-hidden="true" /> Choose a video
              </button>
              <p className="dropzone-hint">or drop it anywhere in this box</p>
            </>
          ) : (
            <>
              <h2 id="upload-title">{sending.phase === 'sending' ? `Uploading ${sending.file.name}` : `Reading ${sending.file.name}`}</h2>
              <Scale value={sending.phase === 'sending' ? sending.sent : null} label={sending.phase === 'sending' ? 'Upload progress' : 'Checking the video'} />
              <p className="figures">
                {sending.phase === 'sending'
                  ? `${formatBytes(sending.file.size * sending.sent)} of ${formatBytes(sending.file.size)}`
                  : 'Checking the video and saving it to storage…'}
              </p>
              {sending.phase === 'sending' && (
                <button className="button button-quiet" type="button" onClick={() => upload.current?.abort()}>Cancel upload</button>
              )}
            </>
          )}
          <AnimatePresence>
            {sending.phase === 'failed' && (
              <motion.div key="upload-error" className="dropzone-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <WarningOctagon size={20} aria-hidden="true" />
                <p>{sending.message}</p>
                {sending.file && (
                  <button className="button button-quiet" type="button" onClick={() => start(sending.file ?? undefined)} disabled={busy}>Try again</button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <p className="visually-hidden" role="status">{announce}</p>

        {list.status === 'loading' && (
          <ul className="plates" aria-busy="true" aria-label="Loading your videos">
            {[0, 1, 2].map((i) => <li key={i} className="plate plate-skeleton" aria-hidden="true" />)}
          </ul>
        )}
        {list.status === 'error' && (
          <div className="panel-error" role="alert">
            <p>{list.message}</p>
            <button className="button button-quiet" type="button" onClick={() => void load()}>
              <ArrowClockwise size={18} aria-hidden="true" /> Try again
            </button>
          </div>
        )}
        {list.status === 'ready' && list.videos.length > 0 && (
          <ul className="plates" aria-label="Your videos">
            <AnimatePresence initial={false}>
              {list.videos.map((video) => (
                <motion.li key={video.id} layout exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="plate">
                  <VideoPlate video={video} poster={posters[video.id]} onRetry={retry} onDelete={remove} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </main>
    </div>
  );
}

function VideoPlate({ video, poster, onRetry, onDelete }: {
  video: VideoRow; poster: string | undefined; onRetry: (v: VideoRow) => Promise<void>; onDelete: (v: VideoRow) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [working, setWorking] = useState(false);
  const interrupted = stalled(video);
  const failed = video.status === 'failed' || interrupted;
  const meta = `${video.frame_count.toLocaleString('en')} frames · ${Math.round(video.fps * 100) / 100} fps · ${video.width}×${video.height} · ${formatDuration(video.duration_s)}`;

  async function confirmDelete() {
    setWorking(true);
    setDeleteError('');
    try {
      await onDelete(video);
    } catch (error) {
      setDeleteError((error as ApiError).message);
      setWorking(false);
    }
  }

  return (
    <article aria-labelledby={`title-${video.id}`}>
      <div className={`plate-image is-${failed ? 'failed' : video.status}`}>
        {video.status === 'ready' && poster ? (
          <Thumb video={video} sheets={[poster]} sample={0} className="plate-poster" />
        ) : failed ? (
          <span className="void-mark" aria-hidden="true">Void</span>
        ) : (
          <span className="developing" aria-hidden="true" />
        )}
      </div>
      <div className="plate-caption">
        <h2 id={`title-${video.id}`}>
          {video.status === 'ready' ? <Link to={`/v/${video.id}`} className="plate-link">{video.title}</Link> : video.title}
        </h2>
        <p className="meta">{meta}</p>

        {video.status === 'processing' && !interrupted && (
          <div className="plate-status">
            <Scale value={video.progress} label={`Processing ${video.title}`} />
            <p>Printing the contact sheet · <span className="figures">{Math.round(video.progress * 100)}%</span></p>
          </div>
        )}
        {failed && (
          <div className="plate-status is-failed" role="alert">
            <p>{interrupted ? 'Processing was interrupted (the server may have restarted).' : video.error ?? 'Processing failed.'}</p>
            <button className="button button-quiet" type="button" disabled={working} onClick={async () => {
              setWorking(true);
              await onRetry(video);
              setWorking(false);
            }}>
              <ArrowClockwise size={18} aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        <div className="plate-actions">
          {video.status === 'ready' && <Link to={`/v/${video.id}`} className="button button-chalk">Open</Link>}
          {confirming ? (
            <span className="confirm" role="group" aria-label={`Delete ${video.title}?`}>
              <span>Delete it and its kept frames?</span>
              <button className="button button-danger" type="button" onClick={() => void confirmDelete()} disabled={working}>
                {working ? 'Deleting…' : 'Delete'}
              </button>
              <button className="button button-quiet" type="button" onClick={() => setConfirming(false)} disabled={working}>Keep it</button>
            </span>
          ) : (
            <button className="button button-quiet" type="button" onClick={() => setConfirming(true)}>
              <Trash size={18} aria-hidden="true" /> Delete
            </button>
          )}
        </div>
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
      </div>
    </article>
  );
}
