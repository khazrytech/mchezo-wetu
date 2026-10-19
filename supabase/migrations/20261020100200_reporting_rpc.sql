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
