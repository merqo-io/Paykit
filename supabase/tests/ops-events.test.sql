-- ops_events (migration 0026): service-role only, a closed kind list, short
-- refs, and a 30-day purge. Run with `supabase test db`.
begin;
select no_plan();

select has_table('paykit', 'ops_events', 'ops_events exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'paykit.ops_events'::regclass),
  'RLS on ops_events');
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'paykit' and tablename = 'ops_events'),
  0, 'ops_events has no policy');

-- Shape rules.
select throws_ok(
  $$ insert into paykit.ops_events (vendor_id, kind, ref, code)
     values ('00260000-0000-0000-0000-00000000000a', 'other', 't1', 'http_502') $$,
  '23514', null, 'unknown kind rejected');
select throws_ok(
  $$ insert into paykit.ops_events (vendor_id, kind, ref, code)
     values ('00260000-0000-0000-0000-00000000000a', 'payment_callback_failed',
             repeat('r', 65), 'http_502') $$,
  '23514', null, 'a 65-character ref rejected');
select throws_ok(
  $$ insert into paykit.ops_events (vendor_id, kind, ref, code)
     values ('00260000-0000-0000-0000-00000000000a', 'payment_callback_failed',
             't1', repeat('c', 65)) $$,
  '23514', null, 'a 65-character code rejected');

-- Purge: a 31-day-old row goes, a 29-day-old row stays.
insert into paykit.ops_events (vendor_id, kind, ref, code, created_at)
values
  ('00260000-0000-0000-0000-00000000000a', 'payment_callback_failed', 'old',
   'timeout', now() - interval '31 days'),
  ('00260000-0000-0000-0000-00000000000a', 'payment_callback_failed', 'kept',
   'timeout', now() - interval '29 days');

select lives_ok($$ select paykit.purge_ops_events() $$, 'purge runs');
select results_eq(
  $$ select ref from paykit.ops_events order by ref $$,
  $$ values ('kept'::text) $$,
  'purge deletes the 31-day-old row and keeps the 29-day-old row');

-- Service role reads and writes, but cannot delete or edit.
set local role service_role;
select lives_ok(
  $$ insert into paykit.ops_events (vendor_id, kind, ref, code)
     values ('00260000-0000-0000-0000-00000000000a', 'payment_callback_failed',
             'svc', 'http_500') $$,
  'service_role inserts');
select is(
  (select count(*)::int from paykit.ops_events), 2, 'service_role selects');
select throws_ok(
  $$ delete from paykit.ops_events $$, '42501', null,
  'service_role cannot delete');
reset role;

-- Clients are locked out.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00260000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
select throws_ok(
  $$ select * from paykit.ops_events $$, '42501', null,
  'authenticated cannot select');
select throws_ok(
  $$ insert into paykit.ops_events (vendor_id, kind, ref, code)
     values ('00260000-0000-0000-0000-00000000000a', 'payment_callback_failed',
             'x', 'x') $$,
  '42501', null, 'authenticated cannot insert');
select throws_ok(
  $$ select paykit.purge_ops_events() $$, '42501', null,
  'authenticated cannot run the purge');
reset role;

set local role anon;
select throws_ok(
  $$ select * from paykit.ops_events $$, '42501', null, 'anon cannot select');
select throws_ok(
  $$ insert into paykit.ops_events (vendor_id, kind, ref, code)
     values ('00260000-0000-0000-0000-00000000000a', 'payment_callback_failed',
             'x', 'x') $$,
  '42501', null, 'anon cannot insert');
reset role;

select * from finish();
rollback;
