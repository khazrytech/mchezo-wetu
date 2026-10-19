-- Mchezo Wetu: schema ya msingi, columns zilizokosekana, indexes na RLS.
-- Inatumia IF NOT EXISTS ili iwe salama kwenye mazingira yaliyopo tayari.

create extension if not exists pgcrypto;

-- ===================== profiles =====================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'user',
  is_approved boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists role text not null default 'user',
  add column if not exists is_approved boolean not null default false,
  add column if not exists is_banned boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists sms_reminders_enabled boolean not null default false,
  add column if not exists sms_reminders_consent_at timestamptz;

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- ===================== contributions =====================
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null,
  due_date date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.contributions
  add column if not exists title text,
  add column if not exists amount numeric,
  add column if not exists due_date date,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now();

create index if not exists contributions_user_id_idx on public.contributions (user_id);
create index if not exists contributions_status_idx on public.contributions (status);
create index if not exists contributions_created_at_idx on public.contributions (created_at desc);

-- ===================== payments =====================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contribution_id uuid references public.contributions(id) on delete set null,
  amount numeric not null,
  reference text,
  method text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists contribution_id uuid references public.contributions(id) on delete set null,
  add column if not exists amount numeric,
  add column if not exists reference text,
  add column if not exists method text,
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists verified_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists payment_type text not null default 'contribution',
  add column if not exists proof_url text,
  add column if not exists provider text,
  add column if not exists phone text,
  add column if not exists channel text,
  add column if not exists provider_status text,
  add column if not exists provider_transid text,
  add column if not exists sonicpesa_order_id text;

create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_contribution_id_idx on public.payments (contribution_id);
create index if not exists payments_created_at_idx on public.payments (created_at desc);
create index if not exists payments_sonicpesa_order_id_idx on public.payments (sonicpesa_order_id);

-- Reference ya malipo lazima iwe ya kipekee (nulls zinaruhusiwa).
create unique index if not exists payments_reference_key
  on public.payments (reference)
  where reference is not null;

-- ===================== audit_logs =====================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);

-- ===================== RLS =====================
-- Server hutumia service_role (inapita RLS). Frontend haisomi tables moja kwa moja,
-- hivyo anon/authenticated hawaruhusiwi kusoma au kuandika moja kwa moja.
alter table public.profiles enable row level security;
alter table public.contributions enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.profiles from anon, authenticated, public;
revoke all on table public.contributions from anon, authenticated, public;
revoke all on table public.payments from anon, authenticated, public;
revoke all on table public.audit_logs from anon, authenticated, public;

grant all on table public.profiles to service_role;
grant all on table public.contributions to service_role;
grant all on table public.payments to service_role;
grant all on table public.audit_logs to service_role;

-- Members wanaweza kusoma profile yao pekee (kwa usalama wa baadaye).
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());
