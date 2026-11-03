-- Entitlement cache: table RLS and grants, the apply function's grants and
-- issued_at guard, and the paid / expired / event-pass gate helper.
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('10000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'entitled@test.local'),
  ('10000000-0000-4000-8000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bystander@test.local');

select has_table('paykit', 'vendor_entitlements', 'paykit.vendor_entitlements exists');
select ok((select relrowsecurity from pg_class where oid = 'paykit.vendor_entitlements'::regclass), 'RLS on vendor_entitlements');

select ok(not has_function_privilege('anon', 'paykit.apply_vendor_entitlement(text,text,boolean,text,timestamptz,timestamptz,timestamptz,timestamptz)', 'execute'), 'anon cannot apply an entitlement');
select ok(not has_function_privilege('authenticated', 'paykit.apply_vendor_entitlement(text,text,boolean,text,timestamptz,timestamptz,timestamptz,timestamptz)', 'execute'), 'authenticated cannot apply an entitlement');
select ok(has_function_privilege('service_role', 'paykit.apply_vendor_entitlement(text,text,boolean,text,timestamptz,timestamptz,timestamptz,timestamptz)', 'execute'), 'service_role can apply an entitlement');

select ok(has_table_privilege('authenticated', 'paykit.vendor_entitlements', 'select'), 'authenticated can read the cache (own row via RLS)');
select ok(not has_table_privilege('authenticated', 'paykit.vendor_entitlements', 'insert'), 'authenticated cannot insert into the cache');
select ok(not has_table_privilege('authenticated', 'paykit.vendor_entitlements', 'update'), 'authenticated cannot update the cache');
select ok(not has_table_privilege('anon', 'paykit.vendor_entitlements', 'select'), 'anon cannot read the cache');

select is(paykit.apply_vendor_entitlement('nobody@test.local', 'paid', false, '90d', null, null, null, '2026-11-01T00:00:00Z'), 'unknown_vendor', 'unknown email is reported');
select is(paykit.vendor_is_entitled('10000000-0000-4000-8000-0000000000e1'), false, 'no cache row is not entitled');

select is(paykit.apply_vendor_entitlement('Entitled@Test.Local', 'paid', false, '90d', null, null, '2099-01-01T00:00:00Z', '2026-11-01T00:00:00Z'), 'stored', 'first push is stored, email matched case-insensitively');
select is(paykit.vendor_is_entitled('10000000-0000-4000-8000-0000000000e1'), true, 'a live paid row is entitled');

select is(paykit.apply_vendor_entitlement('entitled@test.local', 'free', false, '24h', null, null, null, '2026-11-01T00:00:00Z'), 'stale', 'an equal issued_at is a no-op');
select is(paykit.apply_vendor_entitlement('entitled@test.local', 'free', false, '24h', null, null, null, '2026-10-01T00:00:00Z'), 'stale', 'an older issued_at is a no-op');
select is((select tier from paykit.vendor_entitlements where vendor_id = '10000000-0000-4000-8000-0000000000e1'), 'paid', 'a stale push leaves the stored tier alone');

select is(paykit.apply_vendor_entitlement('entitled@test.local', 'paid', false, '90d', null, null, '2000-01-01T00:00:00Z', '2026-11-02T00:00:00Z'), 'stored', 'a newer push replaces the row');
select is(paykit.vendor_is_entitled('10000000-0000-4000-8000-0000000000e1'), false, 'a lapsed valid_until is not entitled with no push');

update paykit.vendor_entitlements set valid_until = null;
select is(paykit.vendor_is_entitled('10000000-0000-4000-8000-0000000000e1'), true, 'a paid row with a null valid_until is open-ended');

select is(paykit.apply_vendor_entitlement('entitled@test.local', 'free', false, '24h', '2000-01-01T00:00:00Z', '2099-01-01T00:00:00Z', null, '2026-11-03T00:00:00Z'), 'stored', 'a free row with an event pass is stored');
select is(paykit.vendor_is_entitled('10000000-0000-4000-8000-0000000000e1'), true, 'a running event pass is entitled');

update paykit.vendor_entitlements set event_pass_ends_at = '2001-01-01T00:00:00Z';
select is(paykit.vendor_is_entitled('10000000-0000-4000-8000-0000000000e1'), false, 'an ended event pass is not entitled');

select throws_ok(
  $$ select paykit.apply_vendor_entitlement('entitled@test.local', 'free', false, '24h', '2000-01-01T00:00:00Z', null, null, '2026-11-04T00:00:00Z') $$,
  '23514', null, 'an event pass needs both a start and an end');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-0000000000e1', 'role', 'authenticated')::text, true);
select is((select count(*)::int from paykit.vendor_entitlements), 1, 'a vendor reads its own cache row');
select throws_like(
  $$ update paykit.vendor_entitlements set tier = 'paid' $$,
  '%permission denied%', 'a vendor cannot write its own cache row');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-0000000000e2', 'role', 'authenticated')::text, true);
select is((select count(*)::int from paykit.vendor_entitlements), 0, 'another vendor cannot read it');
select is(paykit.vendor_is_entitled('10000000-0000-4000-8000-0000000000e1'), false, 'the gate helper reveals nothing about another vendor');
reset role;

select * from finish();
rollback;
