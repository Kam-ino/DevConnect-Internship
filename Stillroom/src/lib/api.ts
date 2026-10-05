// Talking to the Stillroom server: one fetch wrapper that adds the session token and turns every
// failure into an ApiError whose message can be shown as-is.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VideoRow } from '../../shared/types.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const NETWORK = 'Couldn’t reach the Stillroom server. Check your connection and try again.';

// The Supabase project's public URL and key come from the server, so they live in one .env file.
export async function connect(): Promise<SupabaseClient> {
  let res: Response;
  try {
    res = await fetch('/api/config');
  } catch {
    throw new ApiError('Couldn’t reach the Stillroom server. Start it with npm run dev, then reload.', 0, 'network');
  }
  const body = (await res.json().catch(() => null)) as { supabaseUrl?: string; supabaseAnonKey?: string; error?: { message?: string; code?: string } } | null;
  if (!res.ok || !body?.supabaseUrl || !body.supabaseAnonKey) {
    throw new ApiError(body?.error?.message ?? `The server answered ${res.status}.`, res.status, body?.error?.code ?? 'config');
  }
  return createClient(body.supabaseUrl, body.supabaseAnonKey);
}

// Why the last session ended, shown on the sign-in screen.
export let signedOutReason = '';
export const clearSignedOutReason = () => {
  signedOutReason = '';
};

async function token(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new ApiError('Sign in to continue.', 401, 'signed_out');
  return data.session.access_token;
}

async function endSession(sb: SupabaseClient, message: string) {
  signedOutReason = message;
  await sb.auth.signOut({ scope: 'local' });
}

export async function request(sb: SupabaseClient, path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await token(sb)}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, body });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(NETWORK, 0, 'network');
  }
  if (res.ok) return res;
  const failure = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
  const message = failure?.error?.message ?? `The server answered ${res.status} ${res.statusText}.`;
  if (res.status === 401) await endSession(sb, message);
  throw new ApiError(message, res.status, failure?.error?.code ?? 'http_error');
}

// The file name the server chose (Content-Disposition), or a fallback.
export function attachmentName(res: Response, fallback: string): string {
  const header = res.headers.get('Content-Disposition') ?? '';
  return /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)?.[1] ?? fallback;
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// Download a server response as a file, keeping the server's file name.
export async function download(sb: SupabaseClient, path: string, fallbackName: string, init: RequestInit & { json?: unknown } = {}) {
  const res = await request(sb, path, init);
  let blob: Blob;
  try {
    blob = await res.blob();
  } catch {
    throw new ApiError('The download was cut off before it finished. Try again.', 0, 'download_interrupted');
  }
  saveBlob(blob, attachmentName(res, fallbackName));
}

export interface Upload {
  promise: Promise<VideoRow>;
  abort: () => void;
}

// Upload with progress (fetch can't report upload progress, XMLHttpRequest can). The body is the
// raw file; the server streams it to disk and cuts it off past 50 MB.
export function uploadVideo(sb: SupabaseClient, file: File, onProgress: (sent: number) => void): Upload {
  const xhr = new XMLHttpRequest();
  const promise = token(sb).then(
    (bearer) =>
      new Promise<VideoRow>((resolve, reject) => {
        xhr.open('POST', '/api/videos');
        xhr.setRequestHeader('Authorization', `Bearer ${bearer}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
        xhr.upload.onprogress = (event) => onProgress(event.lengthComputable ? event.loaded / event.total : 0);
        xhr.onload = () => {
          const body = (() => {
            try {
              return JSON.parse(xhr.responseText) as { video?: VideoRow; error?: { message?: string; code?: string } };
            } catch {
              return null;
            }
          })();
          if (xhr.status === 201 && body?.video) return resolve(body.video);
          const message = body?.error?.message ?? `The server answered ${xhr.status}.`;
          if (xhr.status === 401) void endSession(sb, message);
          reject(new ApiError(message, xhr.status, body?.error?.code ?? 'http_error'));
        };
        xhr.onerror = () => reject(new ApiError('The upload was interrupted. Check your connection and try again.', 0, 'network'));
        xhr.onabort = () => reject(new ApiError('Upload cancelled.', 0, 'aborted'));
        xhr.send(file);
      }),
  );
  return { promise, abort: () => xhr.abort() };
}
