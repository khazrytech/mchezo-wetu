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
