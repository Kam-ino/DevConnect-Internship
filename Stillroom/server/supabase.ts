// Supabase access. The server never holds a service key: every call is made with the signed-in
// user's own token, so row-level security and the storage policies apply to the server too.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Read on use, so .env (loaded by index.ts) is in place before anything asks. The URL is the bare
// project URL; a pasted REST endpoint (…/rest/v1/) is trimmed back to it.
export const config = {
  get url() {
    return (process.env.SUPABASE_URL?.trim() ?? '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  },
  get anonKey() {
    return process.env.SUPABASE_ANON_KEY?.trim() ?? '';
  },
};
export const configured = () => /^https?:\/\//.test(config.url) && config.anonKey.length > 20;

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function clientFor(token: string): SupabaseClient {
  return createClient(config.url, config.anonKey, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
}

// Verified tokens, kept until they expire (at most 5 minutes) so stepping through frames doesn't
// re-verify on every request. ponytail: in-memory per process, fine for one server.
const verified = new Map<string, { userId: string; until: number }>();

export async function verifyToken(token: string): Promise<string> {
  const now = Date.now();
  const hit = verified.get(token);
  if (hit && hit.until > now) return hit.userId;

  let data: Awaited<ReturnType<SupabaseClient['auth']['getClaims']>>['data'];
  let error: unknown;
  try {
    ({ data, error } = await createClient(config.url, config.anonKey, options).auth.getClaims(token));
  } catch {
    throw new HttpError(502, 'auth_unreachable', 'Stillroom couldn’t reach Supabase to check your sign-in. Check your connection and try again.');
  }
  const sub = data?.claims?.sub;
  if (error || !sub) throw new HttpError(401, 'session_expired', 'Your session has ended. Sign in again.');

  if (verified.size > 500) verified.clear();
  const exp = Number(data?.claims?.exp) * 1000 || now;
  verified.set(token, { userId: sub, until: Math.min(exp, now + 5 * 60_000) });
  return sub;
}

// Turn a Supabase error into something the user can act on.
export function dbError(error: { message?: string; code?: string; hint?: string } | null, action: string): HttpError {
  const message = error?.message ?? '';
  if (message.includes('video_limit')) return new HttpError(409, 'video_limit', 'You already have 5 videos, the most an account can hold. Delete one to upload another.');
  if (message.includes('kept_limit')) return new HttpError(409, 'kept_limit', 'A video keeps at most 600 frames. Remove some kept frames first.');
  if (message.includes('frame_out_of_range')) return new HttpError(422, 'frame_out_of_range', 'That frame isn’t in this video.');
  if (/fetch failed|network|ECONN|ETIMEDOUT/i.test(message)) {
    return new HttpError(502, 'supabase_unreachable', `Stillroom couldn’t reach Supabase to ${action}. Try again in a moment.`);
  }
  return new HttpError(502, 'supabase_error', `Supabase refused to ${action}${message ? `: ${message}` : ''}.`);
}
