-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Folders
create table public.folders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  parent_id uuid references public.folders(id) on delete cascade,
  created_at timestamptz default now() not null
);

-- Notes
create table public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null default 'Untitled',
  content text not null default '',
  tags text[] not null default '{}',
  is_daily boolean not null default false,
  frontmatter jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_updated_at
  before update on public.notes
  for each row execute function update_updated_at();

-- Row Level Security
alter table public.folders enable row level security;
alter table public.notes enable row level security;

create policy "Users own their folders"
  on public.folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users own their notes"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Full-text search index
create index notes_content_search on public.notes
  using gin(to_tsvector('english', title || ' ' || content));
