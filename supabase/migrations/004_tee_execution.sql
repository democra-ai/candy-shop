-- ============================================================
-- Candy Shop — Tier 2 TEE Execution Schema
-- ============================================================
-- Adds "confidential" execution tier on top of the existing
-- open / managed / federated model.
--
--   open       → Tier 0: source visible, user runs locally
--   managed    → Tier 1: platform runs it, prompt hidden from user
--   tee        → Tier 2: runs inside Trusted Execution Environment,
--                prompt hidden from everyone incl. platform ops,
--                attestation proves code integrity on demand
--   federated  → (unchanged) caller-operated execution
-- ============================================================

-- ── Extend execution_model to include 'tee' ────────────────

alter table public.skills drop constraint if exists skills_execution_model_check;

alter table public.skills add constraint skills_execution_model_check
  check (execution_model in ('open', 'managed', 'tee', 'federated'));

-- ── TEE metadata columns on skills ─────────────────────────

alter table public.skills add column if not exists tee_provider text
  check (tee_provider is null or tee_provider in ('phala', 'aws-nitro', 'gcp-cs', 'azure-cc', 'oasis'));

alter table public.skills add column if not exists tee_endpoint text;
alter table public.skills add column if not exists tee_code_hash text;          -- sha256 of deployed container image
alter table public.skills add column if not exists tee_attestation_url text;    -- where the latest attestation doc is served
alter table public.skills add column if not exists tee_last_verified_at timestamptz;

-- ── Attestations — audit log of verifications ──────────────

create table if not exists public.tee_attestations (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id) on delete cascade,
  code_hash text not null,
  provider text not null,
  payload jsonb not null,                 -- full attestation document (quote, certs, report_data)
  signature text,                         -- optional detached signature (base64/hex)
  valid boolean not null default false,
  verified_at timestamptz default now(),
  verifier text                           -- 'platform:local' | 'platform:phala' | 'user:<id>' | ...
);

-- Back-fill: add column if the table already existed without it
alter table public.tee_attestations add column if not exists signature text;

alter table public.tee_attestations enable row level security;

drop policy if exists "Anyone can view attestations" on public.tee_attestations;
create policy "Anyone can view attestations"
  on public.tee_attestations for select using (true);

drop policy if exists "Service role can insert attestations" on public.tee_attestations;
create policy "Service role can insert attestations"
  on public.tee_attestations for insert with check (true);

create index if not exists idx_tee_attestations_skill_id on public.tee_attestations(skill_id);
create index if not exists idx_tee_attestations_verified_at on public.tee_attestations(verified_at desc);

-- ── Extend invocations to record TEE routing + attestation ──

alter table public.invocations drop constraint if exists invocations_provider_check;
alter table public.invocations add constraint invocations_provider_check
  check (provider is null or provider in ('stripe', 'x402', 'free', 'tee'));

alter table public.invocations add column if not exists tee_attestation_id uuid
  references public.tee_attestations(id) on delete set null;

-- ── RPC: latest attestation for a skill ────────────────────

create or replace function public.get_latest_attestation(p_skill_id uuid)
returns public.tee_attestations as $$
declare
  att public.tee_attestations;
begin
  select * into att
  from public.tee_attestations
  where skill_id = p_skill_id and valid = true
  order by verified_at desc
  limit 1;
  return att;
end;
$$ language plpgsql security definer;
