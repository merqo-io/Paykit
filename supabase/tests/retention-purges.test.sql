-- auth_failures IP purge (migration 0031): the IP is nulled after 30 days, the
-- row stays, and no client gains write access. Run with `supabase test db`.
begin;
select no_plan();

select has_function('paykit', 'purge_auth_failure_ips', 'purge function exists');
select ok(
  (select prosecdef from pg_proc where oid = 'paykit.purge_auth_failure_ips()'::regprocedure),
  'purge is security definer');
select ok(
  (select 'search_path=""' = any (proconfig)
     from pg_proc where oid = 'paykit.purge_auth_failure_ips()'::regprocedure),
  'purge pins an empty search_path');

select ok(
  not has_table_privilege('service_role', 'paykit.auth_failures', 'UPDATE'),
  'service_role has no UPDATE on auth_failures');

delete from paykit.auth_failures;
insert into paykit.auth_failures (kit_slug, reason, ip, created_at)
values
  ('kit-old', 'bad_token', '203.0.113.1', now() - interval '31 days'),
  ('kit-new', 'bad_token', '203.0.113.2', now() - interval '29 days'),
  ('kit-nulled', 'bad_token', null, now() - interval '40 days');

select is(paykit.purge_auth_failure_ips(), 1,
  'returns the number of rows changed; an already-null old row is not counted');
select is(
  (select ip from paykit.auth_failures where kit_slug = 'kit-old'), null,
  '31-day-old row has its ip nulled');
select results_eq(
  $$ select kit_slug, reason, created_at < now() - interval '30 days'
       from paykit.auth_failures where kit_slug = 'kit-old' $$,
  $$ values ('kit-old'::text, 'bad_token'::text, true) $$,
  '31-day-old row keeps kit_slug, reason and created_at');
select is(
  (select ip from paykit.auth_failures where kit_slug = 'kit-new'), '203.0.113.2',
  '29-day-old row keeps its ip');
select is(
  (select count(*)::int from paykit.auth_failures), 3, 'no rows deleted');
select is(paykit.purge_auth_failure_ips(), 0, 'a second run changes nothing');

set local role anon;
select throws_ok(
  $$ select paykit.purge_auth_failure_ips() $$, '42501', null,
  'anon cannot run the purge');
reset role;

set local role authenticated;
select throws_ok(
  $$ select paykit.purge_auth_failure_ips() $$, '42501', null,
  'authenticated cannot run the purge');
reset role;

set local role service_role;
select lives_ok(
  $$ select paykit.purge_auth_failure_ips() $$, 'service_role can run the purge');
reset role;

select * from finish();
rollback;
