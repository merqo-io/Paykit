-- Throttling and abuse review need an IP for days, not forever. Nulling it after
-- 30 days keeps the row (kit_slug, reason, created_at) for long-term visibility.
-- The function owner owns the table, so service_role needs no UPDATE grant.
create or replace function paykit.purge_auth_failure_ips()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  update paykit.auth_failures
     set ip = null
   where ip is not null
     and created_at < now() - interval '30 days';
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function paykit.purge_auth_failure_ips() from public, anon, authenticated;
grant execute on function paykit.purge_auth_failure_ips() to service_role;

-- Daily through pg_cron, best effort: where pg_cron is unavailable the
-- migration still applies and a NOTICE says so. Re-running replaces the job.
-- Check with: select jobname, schedule from cron.job;
do $do$
begin
  if not exists (
    select 1 from pg_available_extensions where name = 'pg_cron'
  ) then
    raise notice 'pg_cron is not available: paykit.purge_auth_failure_ips() is not scheduled';
    return;
  end if;

  create extension if not exists pg_cron;
  perform cron.schedule(
    'paykit-auth-failures-ip-purge',
    '41 3 * * *',
    'select paykit.purge_auth_failure_ips()'
  );
  raise notice 'paykit.purge_auth_failure_ips() scheduled daily';
exception when others then
  raise notice 'paykit.purge_auth_failure_ips() was not scheduled: %', sqlerrm;
end
$do$;
