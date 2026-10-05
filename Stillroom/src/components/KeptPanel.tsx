// Kept frames: bookmarks with an optional label, each downloadable at full size, or all as one ZIP.
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'motion/react';
import { DownloadSimple, X } from '@phosphor-icons/react';
import { sampleOf, timecode, type ImageFormat } from '../../shared/frames.ts';
import type { KeptFrame, VideoRow } from '../../shared/types.ts';
import { ApiError, download } from '../lib/api.ts';
import Thumb from './Thumb.tsx';

interface KeptProps {
  sb: SupabaseClient;
  video: VideoRow;
  sheets: readonly string[];
  kept: KeptFrame[];
  frame: number;
  onGo: (frame: number) => void;
  onRemove: (kept: KeptFrame) => void;
  onLabel: (kept: KeptFrame, label: string) => Promise<void>;
  onDownload: (frame: number, format: ImageFormat) => void;
  say: (message: string, tone?: 'info' | 'error') => void;
}

export default function KeptPanel({ sb, video, sheets, kept, frame, onGo, onRemove, onLabel, onDownload, say }: KeptProps) {
  const [format, setFormat] = useState<ImageFormat>('png');
  const [zipping, setZipping] = useState(false);

  async function downloadAll() {
    setZipping(true);
    say(`Preparing ${kept.length} kept frames as a ZIP…`);
    try {
      await download(sb, `/api/videos/${video.id}/export/kept`, 'kept-frames.zip', { method: 'POST', json: { format } });
      say('ZIP of kept frames downloaded.');
    } catch (error) {
      say(`Couldn’t make the ZIP. ${(error as ApiError).message}`, 'error');
    } finally {
      setZipping(false);
    }
  }

  return (
    <section className="side-panel" aria-labelledby="kept-title">
      <header className="side-head">
        <h2 id="kept-title">Kept frames <span className="figures count">{kept.length}</span></h2>
        {kept.length > 0 && (
          <div className="side-tools">
            <label className="visually-hidden" htmlFor="kept-format">Format for the ZIP</label>
            <select id="kept-format" value={format} onChange={(e) => setFormat(e.target.value as ImageFormat)}>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
            <button className="button button-quiet" type="button" onClick={() => void downloadAll()} disabled={zipping}>
              <DownloadSimple size={18} aria-hidden="true" /> {zipping ? 'Preparing…' : 'Download all'}
            </button>
          </div>
        )}
      </header>

      {kept.length === 0 ? (
        <p className="empty-note">Nothing kept yet. Press <kbd>K</kbd> or <strong>Keep frame</strong> to keep the frame you’re on.</p>
      ) : (
        <ul className="kept-list" role="list">
          <AnimatePresence initial={false}>
            {kept.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`kept-item${item.frame_index === frame ? ' is-current' : ''}`}
              >
                <button type="button" className="kept-go" onClick={() => onGo(item.frame_index)} aria-label={`Go to frame ${item.frame_index}`}>
                  <Thumb video={video} sheets={sheets} sample={sampleOf(item.frame_index, video.sample_step)} />
                </button>
                <div className="kept-body">
                  <p className="kept-frame">
                    <span className="figures">Frame {item.frame_index}</span>
                    <span className="figures dim">{timecode(item.frame_index, video.fps)}</span>
                  </p>
                  <Label item={item} onLabel={onLabel} say={say} />
                  <div className="kept-actions">
                    <button className="chip" type="button" onClick={() => onDownload(item.frame_index, 'png')}>PNG</button>
                    <button className="chip" type="button" onClick={() => onDownload(item.frame_index, 'webp')}>WebP</button>
                    <button className="icon-button" type="button" onClick={() => onRemove(item)} aria-label={`Remove frame ${item.frame_index} from kept frames`}>
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function Label({ item, onLabel, say }: { item: KeptFrame; onLabel: KeptProps['onLabel']; say: KeptProps['say'] }) {
  const [value, setValue] = useState(item.label ?? '');
  const save = async () => {
    const label = value.trim();
    if (label === (item.label ?? '')) return;
    try {
      await onLabel(item, label);
    } catch (error) {
      say((error as Error).message, 'error');
      setValue(item.label ?? '');
    }
  };
  return (
    <input
      className="kept-label"
      type="text"
      maxLength={80}
      placeholder="Add a label"
      aria-label={`Label for frame ${item.frame_index}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setValue(item.label ?? '');
          e.currentTarget.blur();
        }
      }}
    />
  );
}
