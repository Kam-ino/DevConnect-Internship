// Runs supabase/schema.sql on PGlite (Postgres compiled to WebAssembly) with minimal stand-ins for
// Supabase's auth and storage schemas, then checks ownership, limits and the index plans.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema public, auth, storage to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant select, insert, update, delete on storage.objects to authenticated;
`);
const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

async function as<T = Record<string, unknown>>(user: string, sql: string) {
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec('reset role;');
  }
}
async function refusal(user: string, sql: string): Promise<string> {
  try {
    await as(user, sql);
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}
const insertVideo = (title: string, size = 1000, seconds = 3) => `insert into public.videos
  (title, container, size_bytes, duration_s, fps, width, height, frame_count, sample_step, sample_count, tile_width, tile_height, sheet_cols, sheet_rows)
  values ('${title}', 'mp4', ${size}, ${seconds}, 24, 1920, 1080, 72, 1, 72, 160, 90, 10, 10) returning id`;

const ids: string[] = [];

test('the schema installs, and installs again cleanly', async () => {
  await db.exec(schema);
  await db.exec(schema);
  await db.exec('grant select, insert, update, delete on public.videos, public.kept_frames to authenticated;');
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);
});

test('an account holds at most 5 videos', async () => {
  for (let i = 0; i < 5; i++) ids.push((await as<{ id: string }>(A, insertVideo(`clip ${i}`)))[0]!.id);
  assert.match(await refusal(A, insertVideo('one too many')), /video_limit/);
});

test('size and length limits are database constraints', async () => {
  assert.match(await refusal(B, insertVideo('big', 60_000_000)), /videos_size_bytes_check/);
  assert.match(await refusal(B, insertVideo('long', 1000, 301)), /videos_duration_s_check/);
});

test('another account can’t see, change, delete or claim the videos', async () => {
  assert.equal((await as(B, 'select id from public.videos')).length, 0);
  assert.equal((await as(B, `update public.videos set title = 'mine' where id = '${ids[0]}' returning id`)).length, 0);
  assert.equal((await as(B, `delete from public.videos where id = '${ids[0]}' returning id`)).length, 0);
  const claim = `insert into public.videos (user_id, title, container, size_bytes, duration_s, fps, width, height, frame_count, sample_step, sample_count, tile_width, tile_height, sheet_cols, sheet_rows)
    values ('${A}', 'x', 'mp4', 1, 1, 24, 2, 2, 1, 1, 1, 160, 2, 10, 10)`;
  assert.match(await refusal(B, claim), /row-level security/);
});

test('kept frames: once per frame, inside the video, owner only', async () => {
  await as(A, `insert into public.kept_frames (video_id, frame_index) values ('${ids[0]}', 10)`);
  assert.match(await refusal(A, `insert into public.kept_frames (video_id, frame_index) values ('${ids[0]}', 10)`), /kept_frames_video_frame_key/);
  assert.match(await refusal(A, `insert into public.kept_frames (video_id, frame_index) values ('${ids[0]}', 72)`), /frame_out_of_range/);
  assert.notEqual(await refusal(B, `insert into public.kept_frames (video_id, frame_index) values ('${ids[0]}', 3)`), '');
});

test('storage: own video folders only', async () => {
  assert.equal(await refusal(A, `insert into storage.objects (bucket_id, name) values ('media', '${A}/${ids[0]}/source.mp4')`), '');
  assert.match(await refusal(A, `insert into storage.objects (bucket_id, name) values ('media', '${A}/11111111-1111-1111-1111-111111111111/x.mp4')`), /row-level security/);
  assert.match(await refusal(B, `insert into storage.objects (bucket_id, name) values ('media', '${A}/${ids[0]}/evil.mp4')`), /row-level security/);
  assert.equal((await as(B, 'select id from storage.objects')).length, 0);
});

test('deleting a video deletes its kept frames', async () => {
  await as(A, `delete from public.videos where id = '${ids[0]}'`);
  const left = await db.query<{ n: number }>(`select count(*)::int as n from public.kept_frames where video_id = '${ids[0]}'`);
  assert.equal(left.rows[0]!.n, 0);
});

test('both app queries use their indexes, with auth.uid() evaluated once', async () => {
  // A realistic spread: 300 accounts with 5 videos each and 30 kept frames per video
  await db.exec(`
    insert into auth.users select gen_random_uuid() from generate_series(1, 300);
    alter table public.videos disable trigger videos_limit;
    insert into public.videos (user_id, title, container, size_bytes, duration_s, fps, width, height, frame_count, sample_step, sample_count, tile_width, tile_height, sheet_cols, sheet_rows)
      select u.id, 'clip', 'mp4', 1000, 3, 24, 1920, 1080, 72, 1, 72, 160, 90, 10, 10 from auth.users u cross join generate_series(1, 5);
    alter table public.videos enable trigger videos_limit;
    insert into public.kept_frames (user_id, video_id, frame_index)
      select v.user_id, v.id, g from public.videos v cross join generate_series(0, 29) g;
    analyze;
  `);
  const plan = async (sql: string) => (await as<{ 'QUERY PLAN': string }>(A, `explain ${sql}`)).map((row) => row['QUERY PLAN']).join('\n');
  const library = await plan('select id, title, status from public.videos order by created_at desc');
  assert.match(library, /videos_user_created_idx/);
  assert.match(library, /InitPlan/);
  const kept = await plan(`select frame_index, label from public.kept_frames where video_id = '${ids[1]}' order by frame_index`);
  assert.match(kept, /kept_frames_video_frame_key/);
});
