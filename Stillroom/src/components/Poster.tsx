// A library poster: the contact-sheet thumbnail at once, then the exact frame at card size from the
// server, so the poster is sharp at any width.
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sampleOf } from '../../shared/frames.ts';
import type { VideoRow } from '../../shared/types.ts';
import { request } from '../lib/api.ts';
import Thumb from './Thumb.tsx';

const loaded = new Map<string, string>(); // video id -> object URL, kept for the session

// One second in (clips often open on black), and always a frame on the first contact sheet.
export const posterFrame = (video: VideoRow) => Math.min(video.frame_count - 1, Math.round(video.fps), 99 * video.sample_step);

export default function Poster({ sb, video, sheet }: { sb: SupabaseClient; video: VideoRow; sheet: string | undefined }) {
  const [url, setUrl] = useState(() => loaded.get(video.id) ?? '');

  useEffect(() => {
    if (loaded.has(video.id)) return;
    const controller = new AbortController();
    request(sb, `/api/videos/${video.id}/frames/${posterFrame(video)}?format=webp&width=960`, { signal: controller.signal })
      .then((res) => res.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        loaded.set(video.id, objectUrl);
        setUrl(objectUrl);
      })
      .catch(() => {}); // the thumbnail stays; a poster is decoration
    return () => controller.abort();
  }, [sb, video]);

  return (
    <>
      {sheet && <Thumb video={video} sheets={[sheet]} sample={sampleOf(posterFrame(video), video.sample_step)} className="plate-poster" />}
      {url && <img className="plate-poster-img" src={url} alt="" />}
    </>
  );
}
