create extension if not exists "pgcrypto";

create table if not exists public.bookmarks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    url text not null,
    tags text[] not null default '{}',
    summary text not null default '',
    note text not null default '',
    raw_content text not null default '',
    embedding double precision[] not null default '{}',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.bookmarks;
create trigger set_updated_at
before update on public.bookmarks
for each row
execute procedure public.handle_updated_at();

create index if not exists bookmarks_user_created_at_idx on public.bookmarks (user_id, created_at desc);

alter table public.bookmarks enable row level security;

create policy "Users can read own bookmarks"
  on public.bookmarks
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
  on public.bookmarks
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bookmarks"
  on public.bookmarks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
  on public.bookmarks
  for delete
  using (auth.uid() = user_id);
