-- ============================================================
-- Candy Shop — Lineage, Manifest & Invocation Schema
-- ============================================================
-- Implements "visible but not accessible" marketplace:
--   - Skill manifests are public, runtime/policy cores are gated
--   - Execution rights (not file downloads) are the product
--   - Lineage tracking: original → fork → remix → licensed derivative
--   - Canonical/official skill designation for ranking
--   - Revenue allocation based on lineage
-- ============================================================

-- ── Lineage columns on skills ──────────────────────────────

alter table public.skills add column if not exists lineage_type text default 'original'
  check (lineage_type in ('original', 'fork', 'remix', 'licensed_derivative'));

alter table public.skills add column if not exists parent_skill_id uuid references public.skills(id) on delete set null;

alter table public.skills add column if not exists is_canonical boolean default false;

alter table public.skills add column if not exists lineage_license text;

alter table public.skills add column if not exists original_author text;

-- ── Execution model columns ────────────────────────────────

alter table public.skills add column if not exists execution_model text default 'open'
  check (execution_model in ('open', 'managed', 'federated'));

alter table public.skills add column if not exists manifest_visibility text default 'full'
  check (manifest_visibility in ('full', 'manifest_only', 'private'));

-- ── Invocations — tracks every skill execution ─────────────
-- This is the core economic event: a skill being *used*, not downloaded

create table if not exists public.invocations (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  caller_id text not null,          -- user_id or agent wallet address
  caller_type text not null default 'user'
    check (caller_type in ('user', 'agent')),
  status text not null default 'pending'
    check (status in ('pending', 'success', 'error', 'payment_required', 'rate_limited')),
  provider text check (provider in ('stripe', 'x402', 'free')),
  amount_charged integer default 0,
  currency text default 'usd',
  input_hash text,                  -- hash of input (not the input itself)
  duration_ms integer,
  created_at timestamptz default now()
);

alter table public.invocations enable row level security;

create policy "Users can view own invocations"
  on public.invocations for select using (auth.uid()::text = caller_id);

create policy "Service role can manage invocations"
  on public.invocations for insert with check (true);

-- ── Revenue Splits — how earnings distribute through lineage ──

create table if not exists public.revenue_splits (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  original_author_share integer not null default 0,   -- percentage 0-100
  operator_share integer not null default 85,
  platform_share integer not null default 15,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (skill_id)
);

alter table public.revenue_splits enable row level security;

create policy "Anyone can view revenue splits"
  on public.revenue_splits for select using (true);

create policy "Service role can manage revenue splits"
  on public.revenue_splits for insert with check (true);

create policy "Service role can update revenue splits"
  on public.revenue_splits for update using (true);

-- ── Indexes ────────────────────────────────────────────────

create index if not exists idx_skills_lineage_type on public.skills(lineage_type);
create index if not exists idx_skills_parent_skill_id on public.skills(parent_skill_id);
create index if not exists idx_skills_is_canonical on public.skills(is_canonical);
create index if not exists idx_skills_execution_model on public.skills(execution_model);
create index if not exists idx_invocations_skill_id on public.invocations(skill_id);
create index if not exists idx_invocations_caller_id on public.invocations(caller_id);
create index if not exists idx_invocations_created_at on public.invocations(created_at desc);

-- ── RPC: Record an invocation and consume entitlement ──────

create or replace function public.record_invocation(
  p_skill_id uuid,
  p_caller_id text,
  p_caller_type text default 'user',
  p_provider text default 'free',
  p_amount integer default 0
)
returns uuid as $$
declare
  inv_id uuid;
begin
  insert into public.invocations (skill_id, caller_id, caller_type, status, provider, amount_charged)
  values (p_skill_id, p_caller_id, p_caller_type, 'success', p_provider, p_amount)
  returning id into inv_id;

  -- If per_call entitlement, consume a call
  if p_caller_type = 'user' then
    perform public.consume_call(p_caller_id::uuid, p_skill_id);
  end if;

  return inv_id;
end;
$$ language plpgsql security definer;

-- ── RPC: Get invocation count for a skill ──────────────────

create or replace function public.get_invocation_count(p_skill_id uuid)
returns bigint as $$
begin
  return (select count(*) from public.invocations where skill_id = p_skill_id and status = 'success');
end;
$$ language plpgsql security definer;

-- ── Default revenue splits for lineage types ───────────────
-- original:            85% operator, 15% platform
-- fork:                70% operator, 15% original author, 15% platform
-- remix:               65% operator, 20% original author, 15% platform
-- licensed_derivative:  60% operator, 25% original author, 15% platform
