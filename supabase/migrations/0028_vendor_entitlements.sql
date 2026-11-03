-- 0028_vendor_entitlements.sql
-- Merqo owns subscriptions and pushes each vendor's entitlement here. This
-- table is a cache of that push; paykit's Pro-only gates read only from it.
create table paykit.vendor_entitlements (
  vendor_id             uuid        primary key references auth.users (id) on delete cascade,
  tier                  text        not null check (tier in ('free', 'paid')),
  founder               boolean     not null default false,
  stats_window          text        not null default '24h' check (stats_window in ('24h', '90d')),
  event_pass_starts_at  timestamptz,
  event_pass_ends_at    timestamptz,
  -- Null on a paid row means open-ended: it only comes from the legacy
  -- vendor_payment_config.plan backfill (0029) and holds until merqo's next push.
  valid_until           timestamptz,
  issued_at             timestamptz not null,
  updated_at            timestamptz not null default now(),
  constraint vendor_entitlements_event_pass_pair
    check ((event_pass_starts_at is null) = (event_pass_ends_at is null))
);

alter table paykit.vendor_entitlements enable row level security;

create policy vendor_entitlements_self_select on paykit.vendor_entitlements
  for select using (vendor_id = (select auth.uid()));

-- Writes happen only through apply_vendor_entitlement (service role).
revoke all on paykit.vendor_entitlements from public, anon, authenticated;
grant select on paykit.vendor_entitlements to authenticated;
grant all on paykit.vendor_entitlements to service_role;

-- Maps the pushed email to auth.users and upserts in one statement. The
-- WHERE on the conflict branch makes the issued_at ordering atomic: a stale or
-- replayed push updates nothing and returns 'stale'.
create function paykit.apply_vendor_entitlement(
  p_email                text,
  p_tier                 text,
  p_founder              boolean,
  p_stats_window         text,
  p_event_pass_starts_at timestamptz,
  p_event_pass_ends_at   timestamptz,
  p_valid_until          timestamptz,
  p_issued_at            timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_vendor uuid;
  v_written uuid;
begin
  select id into v_vendor from auth.users where lower(email) = lower(p_email) limit 1;
  if v_vendor is null then return 'unknown_vendor'; end if;

  insert into paykit.vendor_entitlements as e
    (vendor_id, tier, founder, stats_window, event_pass_starts_at, event_pass_ends_at,
     valid_until, issued_at, updated_at)
  values (v_vendor, p_tier, p_founder, p_stats_window, p_event_pass_starts_at,
          p_event_pass_ends_at, p_valid_until, p_issued_at, now())
  on conflict (vendor_id) do update set
    tier = excluded.tier,
    founder = excluded.founder,
    stats_window = excluded.stats_window,
    event_pass_starts_at = excluded.event_pass_starts_at,
    event_pass_ends_at = excluded.event_pass_ends_at,
    valid_until = excluded.valid_until,
    issued_at = excluded.issued_at,
    updated_at = now()
  where e.issued_at < excluded.issued_at
  returning e.vendor_id into v_written;

  return case when v_written is null then 'stale' else 'stored' end;
end;
$$;
revoke all on function paykit.apply_vendor_entitlement(text, text, boolean, text, timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function paykit.apply_vendor_entitlement(text, text, boolean, text, timestamptz, timestamptz, timestamptz, timestamptz)
  to service_role;

-- The single definition of "Pro features allowed": paid and unexpired, or an
-- event pass currently running. Merqo has no cron, so a lapse must apply here
-- by comparing against now() rather than waiting for a push. SECURITY INVOKER
-- so the own-row RLS policy keeps a signed-in caller from probing another
-- vendor; the refunds policy below only ever asks about auth.uid().
create function paykit.vendor_is_entitled(p_vendor uuid)
returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from paykit.vendor_entitlements e
    where e.vendor_id = p_vendor
      and ((e.tier = 'paid' and (e.valid_until is null or e.valid_until > now()))
        or (e.event_pass_starts_at <= now() and now() < e.event_pass_ends_at))
  );
$$;
revoke all on function paykit.vendor_is_entitled(uuid) from public, anon;
grant execute on function paykit.vendor_is_entitled(uuid) to authenticated, service_role;

-- Same policy name as 0001; only the Pro check moves from the dropped plan
-- column to the entitlement cache.
drop policy refunds_insert_own on paykit.refunds;
create policy refunds_insert_own on paykit.refunds
  for insert
  with check (
    created_by = (select auth.uid())
    and paykit.vendor_is_entitled((select auth.uid()))
    and exists (
      select 1 from paykit.transactions t
      where t.id = transaction_id
        and t.vendor_id = (select auth.uid())
        and t.status = 'confirmed'
    )
  );

create or replace function paykit.enforce_refund_total()
returns trigger
language plpgsql volatile security definer set search_path = '' as $$
declare
  caller_role text := coalesce(pg_catalog.current_setting('role', true), 'unknown');
  checkout_amount integer;
  checkout_status text;
  refunded_total bigint;
  previous_refund_id uuid;
begin
  if tg_op = 'UPDATE' and
    row(new.id, new.transaction_id, new.created_by, new.created_at)
      is distinct from row(old.id, old.transaction_id, old.created_by, old.created_at) then
    raise exception 'refund identity is immutable' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    previous_refund_id := old.id;
  end if;

  -- Check ownership before a privileged lock or amount lookup can disclose
  -- anything about another vendor's checkout. RLS still enforces the insert.
  if caller_role not in ('none', 'postgres', 'service_role') then
    if caller_role <> 'authenticated' or auth.uid() is null
      or new.created_by is distinct from auth.uid()
      or not paykit.vendor_is_entitled(auth.uid())
      or not exists (
        select 1 from paykit.transactions t
        where t.id = new.transaction_id and t.vendor_id = auth.uid()
          and t.status = 'confirmed'
      ) then
      raise exception 'refund not authorized' using errcode = '42501';
    end if;
  end if;

  update paykit.transactions set id = id
  where id = new.transaction_id
  returning amount_cents, status into checkout_amount, checkout_status;
  if not found then
    raise exception 'refund checkout missing' using errcode = '23503';
  end if;
  if checkout_status <> 'confirmed' then
    raise exception 'refund requires a confirmed checkout' using errcode = '23514';
  end if;

  select coalesce(sum(r.refunded_amount_cents::bigint), 0)
    into refunded_total from paykit.refunds r
    where r.transaction_id = new.transaction_id
      and (previous_refund_id is null or r.id <> previous_refund_id);
  if refunded_total + new.refunded_amount_cents::bigint > checkout_amount::bigint then
    raise exception 'refund total exceeds checkout amount' using errcode = '23514';
  end if;
  return new;
end;
$$;
