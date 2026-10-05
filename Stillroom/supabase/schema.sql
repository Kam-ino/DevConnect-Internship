-- Stillroom database. Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- It is safe to run again: every statement replaces what it creates.
--
-- Ownership is enforced here, not only in the app: row-level security on both tables and on the
-- storage bucket means a request can only ever see or change its own user's rows and files.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table if not exists public.videos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  status       text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  progress     real not null default 0 check (progress between 0 and 1),
  error        text check (char_length(error) <= 500),
  container    text not null check (container in ('mp4', 'mov', 'webm', 'mkv')),
  size_bytes   bigint not null check (size_bytes between 1 and 52428800),          -- 50 MB
  duration_s   double precision not null check (duration_s > 0 and duration_s <= 300), -- 5 minutes
  fps          double precision not null check (fps > 0 and fps <= 240),
  width        integer not null check (width > 0),
  height       integer not null check (height > 0),
  frame_count  integer not null check (frame_count > 0),
  sample_step  integer not null check (sample_step >= 1),
  sample_count integer not null check (sample_count >= 1),
  tile_width   integer not null check (tile_width > 0),
  tile_height  integer not null check (tile_height > 0),
  sheet_cols   integer not null check (sheet_cols > 0),
  sheet_rows   integer not null check (sheet_rows > 0),
  sheet_count  integer not null default 0 check (sheet_count >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- A kept frame is a bookmark: the frame number, plus an optional label.
create table if not exists public.kept_frames (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  video_id    uuid not null references public.videos (id) on delete cascade,
  frame_index integer not null check (frame_index >= 0),
  label       text check (char_length(label) <= 80),
  created_at  timestamptz not null default now(),
  -- Keeping the same frame twice keeps it once. This index also serves the workspace's only
  -- query on this table: a video's kept frames in frame order.
  constraint kept_frames_video_frame_key unique (video_id, frame_index)
);

-- ---------------------------------------------------------------------------------------------
-- Indexes, one per access path (see README, "Database design")
-- ---------------------------------------------------------------------------------------------

-- The library: a user's videos, newest first. Also covers the user_id foreign key (cascade deletes).
create index if not exists videos_user_created_idx on public.videos (user_id, created_at desc);
-- Covers kept_frames.user_id for cascade deletes when an account is removed.
create index if not exists kept_frames_user_idx on public.kept_frames (user_id);

-- ---------------------------------------------------------------------------------------------
-- Rules the database enforces
-- ---------------------------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- At most 5 videos per account. The advisory lock serialises one user's concurrent uploads, so
-- two simultaneous inserts can't both pass the count.
create or replace function public.enforce_video_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (select count(*) from public.videos where user_id = new.user_id) >= 5 then
    raise exception 'video_limit' using errcode = 'P0001', hint = 'Delete a video to upload another (the limit is 5).';
  end if;
  return new;
end $$;

-- A kept frame must exist in its video, and a video keeps at most 600 frames (one export's worth).
create or replace function public.enforce_kept_frame() returns trigger
language plpgsql set search_path = '' as $$
declare
  frames integer;
begin
  select frame_count into frames from public.videos where id = new.video_id;
  if frames is null or new.frame_index >= frames then
    raise exception 'frame_out_of_range' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.kept_frames where video_id = new.video_id) >= 600 then
    raise exception 'kept_limit' using errcode = 'P0001', hint = 'A video keeps at most 600 frames.';
  end if;
  return new;
end $$;

drop trigger if exists videos_touch on public.videos;
create trigger videos_touch before update on public.videos
  for each row execute function public.touch_updated_at();

drop trigger if exists videos_limit on public.videos;
create trigger videos_limit before insert on public.videos
  for each row execute function public.enforce_video_limit();

drop trigger if exists kept_frames_check on public.kept_frames;
create trigger kept_frames_check before insert or update of frame_index, video_id on public.kept_frames
  for each row execute function public.enforce_kept_frame();

-- ---------------------------------------------------------------------------------------------
-- Row-level security. (select auth.uid()) is evaluated once per statement, not once per row.
-- ---------------------------------------------------------------------------------------------

alter table public.videos enable row level security;
alter table public.kept_frames enable row level security;
revoke all on public.videos, public.kept_frames from anon;

drop policy if exists "own videos: read" on public.videos;
drop policy if exists "own videos: add" on public.videos;
drop policy if exists "own videos: change" on public.videos;
drop policy if exists "own videos: remove" on public.videos;
create policy "own videos: read" on public.videos for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own videos: add" on public.videos for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own videos: change" on public.videos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own videos: remove" on public.videos for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "own kept frames: read" on public.kept_frames;
drop policy if exists "own kept frames: add" on public.kept_frames;
drop policy if exists "own kept frames: change" on public.kept_frames;
drop policy if exists "own kept frames: remove" on public.kept_frames;
create policy "own kept frames: read" on public.kept_frames for select to authenticated
  using (user_id = (select auth.uid()));
-- Adding a kept frame also requires owning the video it points at.
create policy "own kept frames: add" on public.kept_frames for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
  );
create policy "own kept frames: change" on public.kept_frames for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own kept frames: remove" on public.kept_frames for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Storage: one private bucket. Paths are <user id>/<video id>/<file>.
-- ---------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'image/jpeg', 'application/json'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: read own" on storage.objects;
drop policy if exists "media: write own video folder" on storage.objects;
drop policy if exists "media: replace own video folder" on storage.objects;
drop policy if exists "media: remove own" on storage.objects;

create policy "media: read own" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Files can only go into the folder of a video row the user owns, so storage can't outgrow the
-- 5-video limit.
create policy "media: write own video folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.videos v
                where v.id::text = (storage.foldername(name))[2] and v.user_id = (select auth.uid()))
  );
create policy "media: replace own video folder" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media: remove own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
