-- vendor_prefs onboarding columns: they exist, a vendor can write their own
-- row's values, and cannot touch another vendor's.
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('10000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboard-a@test.local'),
  ('10000000-0000-4000-8000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboard-b@test.local');

insert into paykit.vendor_prefs (vendor_id) values
  ('10000000-0000-4000-8000-0000000000f1'),
  ('10000000-0000-4000-8000-0000000000f2');

select has_column('paykit', 'vendor_prefs', 'onboarding_dismissed_at', 'onboarding_dismissed_at exists');
select has_column('paykit', 'vendor_prefs', 'qr_previewed_at', 'qr_previewed_at exists');
select col_is_null('paykit', 'vendor_prefs', 'onboarding_dismissed_at', 'onboarding_dismissed_at is nullable');
select col_is_null('paykit', 'vendor_prefs', 'qr_previewed_at', 'qr_previewed_at is nullable');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-4000-8000-0000000000f1', 'role', 'authenticated')::text, true);

with upd as (
  update paykit.vendor_prefs
     set onboarding_dismissed_at = now(), qr_previewed_at = now()
   where vendor_id = '10000000-0000-4000-8000-0000000000f1'
  returning 1)
select is((select count(*)::int from upd), 1, 'a vendor can update their own onboarding columns');

with upd as (
  update paykit.vendor_prefs
     set onboarding_dismissed_at = null
   where vendor_id = '10000000-0000-4000-8000-0000000000f1'
  returning 1)
select is((select count(*)::int from upd), 1, 'a vendor can clear their own onboarding_dismissed_at');

with upd as (
  update paykit.vendor_prefs
     set onboarding_dismissed_at = now(), qr_previewed_at = now()
   where vendor_id = '10000000-0000-4000-8000-0000000000f2'
  returning 1)
select is((select count(*)::int from upd), 0, 'a vendor cannot update another vendor''s onboarding columns');
reset role;

select is(
  (select onboarding_dismissed_at from paykit.vendor_prefs where vendor_id = '10000000-0000-4000-8000-0000000000f2'),
  null::timestamptz, 'the other vendor''s row is unchanged');

select * from finish();
rollback;
