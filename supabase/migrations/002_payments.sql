-- ============================================================
-- Candy Shop — Payment Schema (Stripe + x402)
-- ============================================================

-- Add pricing columns to skills table
alter table public.skills add column if not exists pricing_model text default 'free'
  check (pricing_model in ('free', 'one_time', 'per_call', 'subscription'));
alter table public.skills add column if not exists price_amount integer default 0;
alter table public.skills add column if not exists price_currency text default 'usd';
alter table public.skills add column if not exists stripe_price_id text;
alter table public.skills add column if not exists x402_resource_url text;

-- Purchases — tracks every completed payment
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'x402')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'refunded', 'expired')),
  amount integer not null default 0,
  currency text not null default 'usd',
  external_id text,          -- Stripe payment_intent / x402 tx hash
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz
);

alter table public.purchases enable row level security;

create policy "Users can view own purchases"
  on public.purchases for select using (auth.uid() = user_id);

create policy "Service role can insert purchases"
  on public.purchases for insert with check (true);

create policy "Service role can update purchases"
  on public.purchases for update using (true);

-- Entitlements — what a user is allowed to access
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  type text not null default 'permanent'
    check (type in ('permanent', 'subscription', 'per_call')),
  remaining_calls integer,
  expires_at timestamptz,
  granted_at timestamptz default now(),
  provider text not null check (provider in ('stripe', 'x402')),
  purchase_id uuid references public.purchases(id) on delete set null,
  unique (user_id, skill_id)
);

alter table public.entitlements enable row level security;

create policy "Users can view own entitlements"
  on public.entitlements for select using (auth.uid() = user_id);

create policy "Service role can manage entitlements"
  on public.entitlements for insert with check (true);

create policy "Service role can update entitlements"
  on public.entitlements for update using (true);

-- Checkout sessions — ephemeral, tracks in-flight checkouts
create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'x402')),
  status text not null default 'open'
    check (status in ('open', 'completed', 'expired')),
  skill_ids text[] not null default '{}',
  total_amount integer not null default 0,
  currency text not null default 'usd',
  stripe_session_id text,
  x402_nonce text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 minutes'
);

alter table public.checkout_sessions enable row level security;

create policy "Users can view own checkout sessions"
  on public.checkout_sessions for select using (auth.uid() = user_id);

create policy "Service role can manage checkout sessions"
  on public.checkout_sessions for insert with check (true);

create policy "Service role can update checkout sessions"
  on public.checkout_sessions for update using (true);

-- Indexes
create index if not exists idx_purchases_user_id on public.purchases(user_id);
create index if not exists idx_purchases_skill_id on public.purchases(skill_id);
create index if not exists idx_purchases_status on public.purchases(status);
create index if not exists idx_purchases_external_id on public.purchases(external_id);
create index if not exists idx_entitlements_user_id on public.entitlements(user_id);
create index if not exists idx_entitlements_skill_id on public.entitlements(skill_id);
create index if not exists idx_checkout_sessions_stripe on public.checkout_sessions(stripe_session_id);

-- RPC: Check if user has entitlement for a skill
create or replace function public.check_entitlement(p_user_id uuid, p_skill_id uuid)
returns boolean as $$
declare
  ent record;
begin
  select * into ent from public.entitlements
  where user_id = p_user_id and skill_id = p_skill_id;

  if not found then return false; end if;

  -- Check expiry for subscriptions
  if ent.type = 'subscription' and ent.expires_at < now() then
    return false;
  end if;

  -- Check remaining calls
  if ent.type = 'per_call' and (ent.remaining_calls is null or ent.remaining_calls <= 0) then
    return false;
  end if;

  return true;
end;
$$ language plpgsql security definer;

-- RPC: Decrement per-call entitlement
create or replace function public.consume_call(p_user_id uuid, p_skill_id uuid)
returns boolean as $$
declare
  ent record;
begin
  select * into ent from public.entitlements
  where user_id = p_user_id and skill_id = p_skill_id
  for update;

  if not found then return false; end if;

  if ent.type = 'per_call' then
    if ent.remaining_calls is null or ent.remaining_calls <= 0 then
      return false;
    end if;
    update public.entitlements
    set remaining_calls = remaining_calls - 1
    where id = ent.id;
  end if;

  return true;
end;
$$ language plpgsql security definer;
