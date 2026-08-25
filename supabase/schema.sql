create extension if not exists "pgcrypto";

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  plans jsonb not null default '[]'::jsonb,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.workouts (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id text not null,
  performed_on date not null,
  logs jsonb not null check (jsonb_typeof(logs) = 'array'),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workouts_user_date_idx
on public.workouts (user_id, performed_on desc);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checked_in_on date not null,
  body_weight numeric(6,2) check (body_weight is null or body_weight > 0),
  note text not null default '',
  photo_path text not null,
  created_at timestamptz not null default now(),
  unique (user_id, checked_in_on)
);

alter table public.user_settings enable row level security;
alter table public.workouts enable row level security;
alter table public.check_ins enable row level security;

drop policy if exists "Users manage their settings" on public.user_settings;
create policy "Users manage their settings"
on public.user_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage their workouts" on public.workouts;
create policy "Users manage their workouts"
on public.workouts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage their check-ins" on public.check_ins;
create policy "Users manage their check-ins"
on public.check_ins for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  5242880,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their progress photos" on storage.objects;
create policy "Users upload their progress photos"
on storage.objects for insert
with check (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users read their progress photos" on storage.objects;
create policy "Users read their progress photos"
on storage.objects for select
using (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update their progress photos" on storage.objects;
create policy "Users update their progress photos"
on storage.objects for update
using (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete their progress photos" on storage.objects;
create policy "Users delete their progress photos"
on storage.objects for delete
using (
  bucket_id = 'progress-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
