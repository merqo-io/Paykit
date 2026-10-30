-- A failure log Merqo reads through /api/merqo/vendor-activity. `ref` is an
-- internal id (a transaction id) and `code` a short machine code (`http_502`,
-- `timeout`): never a message, name, phone or email. The kind list holds only
-- what paykit writes; `payment_claim_stuck` is computed from transactions.
create table paykit.ops_events (
  id bigint generated always as identity primary key,
  vendor_id uuid not null,
  kind text not null check (kind in ('payment_callback_failed')),
  ref text not null check (char_length(ref) <= 64),
  code text not null check (char_length(code) <= 64),
  created_at timestamptz not null default now()
);

create index ops_events_vendor_created_idx
  on paykit.ops_events (vendor_id, created_at desc);

-- Service role only: RLS on with no policy, and no client grant.
alter table paykit.ops_events enable row level security;
revoke all on paykit.ops_events from public, anon, authenticated, service_role;
grant select, insert on paykit.ops_events to service_role;

create or replace function paykit.purge_ops_events()
returns void
language sql
security definer
set search_path = paykit
as $$
  delete from paykit.ops_events where created_at < now() - interval '30 days';
$$;

revoke execute on function paykit.purge_ops_events() from public, anon, authenticated;
grant execute on function paykit.purge_ops_events() to service_role;

-- Daily through pg_cron, best effort: where pg_cron is unavailable the
-- migration still applies and a NOTICE says so. Re-running replaces the job.
-- Check with: select jobname, schedule from cron.job;
do $do$
begin
  if not exists (
    select 1 from pg_available_extensions where name = 'pg_cron'
  ) then
    raise notice 'pg_cron is not available: paykit.purge_ops_events() is not scheduled';
    return;
  end if;

  create extension if not exists pg_cron;
  perform cron.schedule(
    'paykit-ops-events-purge',
    '17 3 * * *',
    'select paykit.purge_ops_events()'
  );
  raise notice 'paykit.purge_ops_events() scheduled daily';
exception when others then
  raise notice 'paykit.purge_ops_events() was not scheduled: %', sqlerrm;
end
$do$;
