-- Mchezo Wetu - SQL moja ya kuendesha yote.
-- Nakili faili hili lote kwenye Supabase -> SQL Editor, kisha bonyeza Run.
-- Inaunganisha migrations zote 5 + kurudisha ruhusa (GRANT) za service_role.

-- =====================================================================
-- 20261016000000_admin_review_metadata.sql
-- =====================================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;


-- =====================================================================
-- 20261016001500_payment_reminders.sql
-- =====================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_reminders_consent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.payment_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('due_soon', 'due_today', 'overdue')),
  scheduled_for date NOT NULL,
  status text NOT NULL DEFAULT 'sending'
    CHECK (status IN ('sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contribution_id, reminder_type, scheduled_for)
);

CREATE INDEX IF NOT EXISTS payment_reminder_logs_status_updated_idx
  ON public.payment_reminder_logs (status, updated_at);

ALTER TABLE public.payment_reminder_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_reminder_logs FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.payment_reminder_logs TO service_role;


-- =====================================================================
-- 20261020100000_core_schema.sql
-- =====================================================================
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


-- =====================================================================
-- 20261020100100_announcements.sql
-- =====================================================================
-- Mchezo Wetu: matangazo (announcements) yanayoonekana kwa wanachama.
-- Salama kwenye hifadhidata iliyopo tayari: huongeza columns zilizokosekana.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hifadhidata za awali zinaweza kuwa na table yenye muundo tofauti
-- (mfano id integer, message text, date text). Ongeza columns zinazokosekana.
alter table public.announcements
  add column if not exists body text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Hamisha maudhui kutoka column ya zamani 'message' ikiwa ipo.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'announcements' and column_name = 'message'
  ) then
    update public.announcements
      set body = coalesce(nullif(body, ''), nullif(message, ''))
      where body is null or body = '';
  end if;
end $$;

-- Uhaki wa mwisho: kila tangazo liwe na maudhui.
update public.announcements
  set body = coalesce(nullif(body, ''), nullif(title, ''), 'Tangazo')
  where body is null or body = '';

create index if not exists announcements_active_created_idx
  on public.announcements (is_active, created_at desc);

-- Tables za zamani zinaweza kuwa na id ya integer isiyo na default.
-- Hivyo kuongeza tangazo jipya kunahitaji sequence.
do $$
declare
  id_type text;
  id_default text;
begin
  select data_type, column_default into id_type, id_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'announcements' and column_name = 'id';

  if id_default is null and id_type in ('integer', 'bigint', 'smallint') then
    execute 'create sequence if not exists public.announcements_id_seq';
    execute 'alter table public.announcements alter column id set default nextval(''public.announcements_id_seq'')';
    execute 'select setval(''public.announcements_id_seq'', coalesce((select max(id) from public.announcements), 0) + 1, false)';
  end if;
end $$;

alter table public.announcements enable row level security;
revoke all on table public.announcements from anon, authenticated, public;
grant all on table public.announcements to service_role;


-- =====================================================================
-- 20261020100200_reporting_rpc.sql
-- =====================================================================
-- Mchezo Wetu: aggregation ya takwimu za admin upande wa database.
-- Hii inaepusha kuload rows zote kwenye server kwa data kubwa.

create or replace function public.admin_summary_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'users', (select count(*) from public.profiles where role <> 'admin'),
    'active', (select count(*) from public.profiles where role <> 'admin' and is_approved and not is_banned),
    'blocked', (select count(*) from public.profiles where role <> 'admin' and is_banned),
    'admins', (select count(*) from public.profiles where role = 'admin'),
    'pendingPayments', (select count(*) from public.payments where status = 'pending'),
    'verifiedPayments', (select count(*) from public.payments where status = 'verified'),
    'rejectedPayments', (select count(*) from public.payments where status = 'rejected'),
    'verifiedAmount', coalesce((select sum(amount) from public.payments where status = 'verified'), 0),
    'pendingAmount', coalesce((select sum(amount) from public.payments where status = 'pending'), 0),
    'assignedContributions', coalesce((select sum(amount) from public.contributions where status <> 'cancelled'), 0)
  );
$$;

revoke all on function public.admin_summary_stats() from anon, authenticated, public;
grant execute on function public.admin_summary_stats() to service_role;


-- =====================================================================
-- RUHUSA (GRANT) - suluhisho la "permission denied for table ..."
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
