-- inquiry_forms and inquiries: a vendor works only their own rows, can
-- never insert an inquiry, and anon has no access. Run with `supabase test db`.
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00250000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'inquiry-a@test.local'),
  ('00250000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'inquiry-b@test.local');

insert into paykit.inquiry_forms (vendor_id, business_name)
values ('00250000-0000-0000-0000-00000000000b', 'B Cart');

insert into paykit.inquiries (id, vendor_id, customer_name, customer_phone, message)
values
  ('00250000-0000-0000-0000-0000000000a1', '00250000-0000-0000-0000-00000000000a',
   'Client A', '91234567', 'hello A'),
  ('00250000-0000-0000-0000-0000000000b1', '00250000-0000-0000-0000-00000000000b',
   'Client B', '91234567', 'hello B');

select ok(
  (select relrowsecurity from pg_class where oid = 'paykit.inquiry_forms'::regclass),
  'RLS on inquiry_forms');
select ok(
  (select relrowsecurity from pg_class where oid = 'paykit.inquiries'::regclass),
  'RLS on inquiries');

select matches(
  (select public_id from paykit.inquiry_forms
   where vendor_id = '00250000-0000-0000-0000-00000000000b'),
  '^[0-9a-f]{16}$', 'a form gets a random 16-hex public id');
select throws_ok(
  $$ insert into paykit.inquiries (vendor_id, customer_name, customer_phone, message,
       terms_url)
     values ('00250000-0000-0000-0000-00000000000a', 'X', '91234567', 'm', 'https://x') $$,
  '23514', null, 'a terms snapshot needs url, version and time together');

-- Vendor A.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00250000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

select results_eq(
  $$ select id from paykit.inquiries $$,
  $$ values ('00250000-0000-0000-0000-0000000000a1'::uuid) $$,
  'vendor A reads only their own inquiries');
select is_empty(
  $$ select 1 from paykit.inquiry_forms $$,
  'vendor A cannot read vendor B''s form');
select throws_ok(
  $$ insert into paykit.inquiries (vendor_id, customer_name, customer_phone, message)
     values ('00250000-0000-0000-0000-00000000000a', 'X', '91234567', 'm') $$,
  '42501', null, 'a vendor cannot insert an inquiry, even their own');
select lives_ok(
  $$ update paykit.inquiries set status = 'contacted'
     where id = '00250000-0000-0000-0000-0000000000a1' $$,
  'vendor A updates their own inquiry status');
select throws_ok(
  $$ update paykit.inquiries set booking_id = null
     where id = '00250000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'a vendor cannot set booking_id');
select lives_ok(
  $$ delete from paykit.inquiries where id = '00250000-0000-0000-0000-0000000000b1' $$,
  'deleting vendor B''s inquiry is a silent no-op');
select lives_ok(
  $$ insert into paykit.inquiry_forms (vendor_id, business_name)
     values ('00250000-0000-0000-0000-00000000000a', 'A Cart') $$,
  'vendor A creates their own form');
select throws_ok(
  $$ insert into paykit.inquiry_forms (vendor_id, business_name, public_id)
     values ('00250000-0000-0000-0000-00000000000a', 'A', '0123456789abcdef') $$,
  '42501', null, 'a vendor cannot choose a public id');
select throws_ok(
  $$ insert into paykit.inquiry_forms (vendor_id, business_name)
     values ('00250000-0000-0000-0000-00000000000b', 'Hijack') $$,
  '42501', null, 'vendor A cannot create a form for vendor B');
reset role;

select is(
  (select count(*)::int from paykit.inquiries
   where id = '00250000-0000-0000-0000-0000000000b1'),
  1, 'vendor B''s inquiry survived vendor A''s delete');

-- anon.
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
select throws_ok(
  $$ select 1 from paykit.inquiries $$,
  '42501', null, 'anon has no access to inquiries');
select throws_ok(
  $$ select 1 from paykit.inquiry_forms $$,
  '42501', null, 'anon has no access to inquiry_forms');
reset role;

select * from finish();
rollback;
