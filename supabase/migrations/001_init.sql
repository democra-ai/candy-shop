-- ============================================================
-- Candy Shop — Supabase Schema
-- ============================================================

-- User Profiles
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  namespace text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;

create policy "Anyone can view profiles"
  on public.user_profiles for select using (true);

create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.user_profiles for insert with check (auth.uid() = id);

-- Skills
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  description text default '',
  category text not null default 'Tools',
  icon text default '📦',
  color text default 'bg-indigo-100',
  tags text[] default '{}',
  install_command text default '',
  repo text default '',
  skill_md_url text default '',
  config jsonb default '{}',
  greeting text,
  popularity integer default 0,
  download_count integer default 0,
  star_count integer default 0,
  avg_rating numeric(3,2) default 0,
  status text default 'active' check (status in ('draft', 'active', 'archived')),
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.skills enable row level security;

create policy "Anyone can view public skills"
  on public.skills for select using (is_public = true);

create policy "Users can view own skills"
  on public.skills for select using (auth.uid() = user_id);

create policy "Users can insert own skills"
  on public.skills for insert with check (auth.uid() = user_id);

create policy "Users can update own skills"
  on public.skills for update using (auth.uid() = user_id);

create policy "Users can delete own skills"
  on public.skills for delete using (auth.uid() = user_id);

-- Cravings
create table if not exists public.cravings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text default '',
  category text not null default 'General',
  tags text[] default '{}',
  budget text default '',
  urgency text default 'medium' check (urgency in ('low', 'medium', 'high')),
  status text default 'open' check (status in ('open', 'in-progress', 'fulfilled')),
  emoji text default '💡',
  match_count integer default 0,
  posted_by text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cravings enable row level security;

create policy "Anyone can view cravings"
  on public.cravings for select using (true);

create policy "Users can insert own cravings"
  on public.cravings for insert with check (auth.uid() = user_id);

create policy "Users can update own cravings"
  on public.cravings for update using (auth.uid() = user_id);

create policy "Users can delete own cravings"
  on public.cravings for delete using (auth.uid() = user_id);

-- Stars
create table if not exists public.stars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, skill_id)
);

alter table public.stars enable row level security;

create policy "Anyone can view stars"
  on public.stars for select using (true);

create policy "Auth users can star"
  on public.stars for insert with check (auth.uid() = user_id);

create policy "Users can unstar own"
  on public.stars for delete using (auth.uid() = user_id);

-- Ratings
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  score integer not null check (score >= 1 and score <= 5),
  comment text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, skill_id)
);

alter table public.ratings enable row level security;

create policy "Anyone can view ratings"
  on public.ratings for select using (true);

create policy "Auth users can rate"
  on public.ratings for insert with check (auth.uid() = user_id);

create policy "Users can update own rating"
  on public.ratings for update using (auth.uid() = user_id);

create policy "Users can delete own rating"
  on public.ratings for delete using (auth.uid() = user_id);

-- Downloads tracking
create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.downloads enable row level security;

create policy "Anyone can view downloads"
  on public.downloads for select using (true);

create policy "Anyone can insert downloads"
  on public.downloads for insert with check (true);

-- RPC: Increment download count atomically
create or replace function public.increment_download(p_skill_id uuid)
returns void as $$
begin
  update public.skills
  set download_count = download_count + 1
  where id = p_skill_id;

  insert into public.downloads (skill_id)
  values (p_skill_id);
end;
$$ language plpgsql security definer;

-- RPC: Update star count on skill after star/unstar
create or replace function public.refresh_star_count(p_skill_id uuid)
returns void as $$
begin
  update public.skills
  set star_count = (select count(*) from public.stars where skill_id = p_skill_id)
  where id = p_skill_id;
end;
$$ language plpgsql security definer;

-- RPC: Update average rating on skill
create or replace function public.refresh_avg_rating(p_skill_id uuid)
returns void as $$
begin
  update public.skills
  set avg_rating = coalesce(
    (select avg(score)::numeric(3,2) from public.ratings where skill_id = p_skill_id),
    0
  )
  where id = p_skill_id;
end;
$$ language plpgsql security definer;

-- Indexes
create index if not exists idx_skills_category on public.skills(category);
create index if not exists idx_skills_popularity on public.skills(popularity desc);
create index if not exists idx_skills_star_count on public.skills(star_count desc);
create index if not exists idx_skills_created_at on public.skills(created_at desc);
create index if not exists idx_cravings_status on public.cravings(status);
create index if not exists idx_cravings_created_at on public.cravings(created_at desc);
create index if not exists idx_stars_user_id on public.stars(user_id);
create index if not exists idx_stars_skill_id on public.stars(skill_id);
create index if not exists idx_ratings_skill_id on public.ratings(skill_id);

-- Full-text search on skills
alter table public.skills add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index if not exists idx_skills_fts on public.skills using gin(fts);
