begin;
select no_plan();

select has_index('paykit', 'admin_audit', 'admin_audit_admin_id_idx', 'paykit.admin_audit (admin_id) is indexed');
select has_index('paykit', 'feedback', 'feedback_vendor_id_idx', 'paykit.feedback (vendor_id) is indexed');
select has_index('paykit', 'refunds', 'refunds_created_by_idx', 'paykit.refunds (created_by) is indexed');

select is(
  (select count(*)::int from pg_tables where schemaname = 'paykit' and not rowsecurity),
  0, 'every paykit table has row level security on');

-- admins: admins only; pricing: public read; auth_failures: server-only.
insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-0000-0000-0000-00000000a301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hygiene-admin@test.local'),
  ('a0000000-0000-0000-0000-00000000a302', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hygiene-vendor@test.local');
insert into paykit.admins (user_id) values ('a0000000-0000-0000-0000-00000000a301');

select ok(not has_table_privilege(r, 'paykit.auth_failures', p), r || ' has no ' || p || ' on paykit.auth_failures')
from unnest(array['anon', 'authenticated']) r, unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p;
select ok(not has_table_privilege('anon', 'paykit.admins', p), 'anon has no ' || p || ' on paykit.admins')
from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p;
select ok(not has_table_privilege(r, t, p), r || ' has no ' || p || ' on ' || t)
from unnest(array['anon', 'authenticated']) r,
     unnest(array['paykit.pricing', 'paykit.admins']) t,
     unnest(array['INSERT', 'UPDATE', 'DELETE']) p;

set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
select is((select count(*)::int from paykit.pricing), 1, 'anyone reads the price');
select throws_ok($$ select 1 from paykit.auth_failures $$, '42501', null, 'anon cannot read paykit.auth_failures');
select throws_ok($$ select 1 from paykit.admins $$, '42501', null, 'anon cannot read paykit.admins');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000a302', 'role', 'authenticated')::text, true);
select is((select count(*)::int from paykit.admins), 0, 'a vendor cannot list admins');
select throws_ok($$ select 1 from paykit.auth_failures $$, '42501', null, 'authenticated cannot read paykit.auth_failures');
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000a301', 'role', 'authenticated')::text, true);
select ok((select count(*)::int from paykit.admins) >= 1, 'an admin lists admins');
reset role;

select * from finish();
rollback;
