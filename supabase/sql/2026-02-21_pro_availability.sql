-- Cloud-synced availability for professional accounts
-- Run this once in Supabase SQL Editor.

create table if not exists public.pro_availability (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  week jsonb not null default '{}'::jsonb,
  blocked_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pro_availability enable row level security;

drop policy if exists "pro_availability_select_own" on public.pro_availability;
create policy "pro_availability_select_own"
on public.pro_availability
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "pro_availability_insert_own" on public.pro_availability;
create policy "pro_availability_insert_own"
on public.pro_availability
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "pro_availability_update_own" on public.pro_availability;
create policy "pro_availability_update_own"
on public.pro_availability
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "pro_availability_delete_own" on public.pro_availability;
create policy "pro_availability_delete_own"
on public.pro_availability
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.pro_availability_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pro_availability_updated_at on public.pro_availability;
create trigger trg_pro_availability_updated_at
before update on public.pro_availability
for each row
execute function public.pro_availability_touch_updated_at();
