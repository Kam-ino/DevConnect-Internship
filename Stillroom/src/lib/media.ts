// A processed video's assets in Supabase Storage: the contact sheets and the frame timestamps.
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VideoRow } from '../../shared/types.ts';

export const BUCKET = 'media';
export const folderOf = (video: VideoRow) => `${video.user_id}/${video.id}`;
export const sheetPath = (video: VideoRow, sheet: number) => `${folderOf(video)}/sheet-${String(sheet).padStart(3, '0')}.jpg`;

const SIGNED_FOR = 6 * 60 * 60; // seconds

// Signed URLs for a set of videos' first sheets (the library posters), keyed by video id.
export async function posterUrls(sb: SupabaseClient, videos: VideoRow[]): Promise<Record<string, string>> {
  const ready = videos.filter((v) => v.status === 'ready' && v.sheet_count > 0);
  if (!ready.length) return {};
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(ready.map((v) => sheetPath(v, 0)), SIGNED_FOR);
  const urls: Record<string, string> = {};
  data?.forEach((item, i) => {
    const video = ready[i];
    if (video && item.signedUrl) urls[video.id] = item.signedUrl;
  });
  return urls;
}

export type Assets =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; sheets: string[]; times: number[] };

// Every sheet's URL plus the frame timestamps, for the workspace.
export function useAssets(sb: SupabaseClient, video: VideoRow | null, attempt: number): Assets {
  const [assets, setAssets] = useState<Assets>({ status: 'loading' });
  const key = video && video.status === 'ready' ? `${video.id}:${video.sheet_count}` : '';

  useEffect(() => {
    if (!video || !key) return;
    let live = true;
    setAssets({ status: 'loading' });
    (async () => {
      const paths = Array.from({ length: video.sheet_count }, (_, i) => sheetPath(video, i));
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls([...paths, `${folderOf(video)}/frames.json`], SIGNED_FOR);
      if (error || !data || data.some((item) => !item.signedUrl)) throw new Error('storage');
      const urls = data.map((item) => item.signedUrl ?? '');
      const res = await fetch(urls[urls.length - 1]!);
      if (!res.ok) throw new Error('times');
      const times = (await res.json()) as number[];
      if (live) setAssets({ status: 'ready', sheets: urls.slice(0, -1), times });
    })().catch(() => {
      if (live) setAssets({ status: 'error', message: 'Couldn’t load this video’s contact sheets from storage. Check your connection and try again.' });
    });
    return () => {
      live = false;
    };
  }, [sb, key, attempt]); // `video` is read through `key`: reload only when its sheets change

  return assets;
}
