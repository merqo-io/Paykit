-- payment_evidence and the paykit-payment-proofs bucket: a vendor reads only
-- their own, and only the service role writes. Run with `supabase test db`.
begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00220000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'evidence-a@test.local'),
  ('00220000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'evidence-b@test.local');

insert into paykit.transactions (id, vendor_id, kit_slug, order_ref, amount_cents, status, qr_payload)
values
  ('00220000-0000-0000-0000-0000000d0a01', '00220000-0000-0000-0000-00000000000a',
   'qkit', 'EV-A-001', 500, 'claimed', 'payload-a1'),
  ('00220000-0000-0000-0000-0000000d0a02', '00220000-0000-0000-0000-00000000000a',
   'qkit', 'EV-A-002', 500, 'pending', 'payload-a2'),
  ('00220000-0000-0000-0000-0000000d0b01', '00220000-0000-0000-0000-00000000000b',
   'qkit', 'EV-B-001', 900, 'claimed', 'payload-b1');

insert into paykit.payment_evidence (transaction_id, kind, storage_path, content_hash)
values
  ('00220000-0000-0000-0000-0000000d0a01', 'screenshot',
   '00220000-0000-0000-0000-00000000000a/00220000-0000-0000-0000-0000000d0a01',
   repeat('a', 64)),
  ('00220000-0000-0000-0000-0000000d0b01', 'screenshot',
   '00220000-0000-0000-0000-00000000000b/00220000-0000-0000-0000-0000000d0b01',
   repeat('b', 64));

insert into storage.objects (bucket_id, name)
values
  ('paykit-payment-proofs',
   '00220000-0000-0000-0000-00000000000a/00220000-0000-0000-0000-0000000d0a01'),
  ('paykit-payment-proofs',
   '00220000-0000-0000-0000-00000000000b/00220000-0000-0000-0000-0000000d0b01');

select ok(
  (select relrowsecurity from pg_class where oid = 'paykit.payment_evidence'::regclass),
  'RLS on payment_evidence');

-- Shape rules.
select throws_ok(
  $$ insert into paykit.payment_evidence (transaction_id, kind, storage_path, content_hash)
     values ('00220000-0000-0000-0000-0000000d0a01', 'screenshot', 'x', repeat('c', 64)) $$,
  '23505', null, 'one screenshot row per transaction');
select throws_ok(
  $$ insert into paykit.payment_evidence (transaction_id, kind, storage_path, content_hash)
     values ('00220000-0000-0000-0000-0000000d0a02', 'bank_feed', 'x', repeat('c', 64)) $$,
  '23514', null, 'unknown evidence kind rejected');
select throws_ok(
  $$ insert into paykit.payment_evidence (transaction_id, kind, storage_path, content_hash)
     values ('00220000-0000-0000-0000-0000000d0a02', 'screenshot', 'x', 'not-a-hash') $$,
  '23514', null, 'a screenshot needs a sha256 hex hash');
select throws_ok(
  $$ insert into paykit.payment_evidence (transaction_id, kind, content_hash)
     values ('00220000-0000-0000-0000-0000000d0a02', 'screenshot', repeat('c', 64)) $$,
  '23514', null, 'a screenshot needs a storage path');

-- The bucket.
select is(
  (select public from storage.buckets where id = 'paykit-payment-proofs'),
  false, 'the proof bucket is private');
select is(
  (select file_size_limit from storage.buckets where id = 'paykit-payment-proofs'),
  1048576::bigint, 'the proof bucket caps objects at 1 MB');
select is(
  (select allowed_mime_types from storage.buckets where id = 'paykit-payment-proofs'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'the proof bucket accepts only JPEG, PNG and WebP');

-- Vendor A.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00220000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

select results_eq(
  $$ select transaction_id from paykit.payment_evidence $$,
  $$ values ('00220000-0000-0000-0000-0000000d0a01'::uuid) $$,
  'vendor A reads only their own evidence');
select is_empty(
  $$ select 1 from paykit.payment_evidence
     where transaction_id = '00220000-0000-0000-0000-0000000d0b01' $$,
  'vendor A cannot read vendor B''s evidence');
select is_empty(
  $$ select 1 from paykit.payment_evidence where content_hash = repeat('b', 64) $$,
  'vendor A cannot find vendor B''s evidence by its hash');
select throws_ok(
  $$ insert into paykit.payment_evidence (transaction_id, kind, storage_path, content_hash)
     values ('00220000-0000-0000-0000-0000000d0a02', 'screenshot', 'x', repeat('c', 64)) $$,
  '42501', null, 'a vendor cannot write evidence, even for their own transaction');
select throws_ok(
  $$ update paykit.payment_evidence set detail = '{"amount_match": true}'::jsonb
     where transaction_id = '00220000-0000-0000-0000-0000000d0a01' $$,
  '42501', null, 'a vendor cannot edit their own evidence');
select throws_ok(
  $$ delete from paykit.payment_evidence
     where transaction_id = '00220000-0000-0000-0000-0000000d0a01' $$,
  '42501', null, 'a vendor cannot delete their own evidence');

select results_eq(
  $$ select name from storage.objects where bucket_id = 'paykit-payment-proofs' $$,
  $$ values ('00220000-0000-0000-0000-00000000000a/00220000-0000-0000-0000-0000000d0a01') $$,
  'vendor A sees only their own proof object');
reset role;

-- Vendor B sees the mirror image.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '00220000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);
select results_eq(
  $$ select transaction_id from paykit.payment_evidence $$,
  $$ values ('00220000-0000-0000-0000-0000000d0b01'::uuid) $$,
  'vendor B reads only their own evidence');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'paykit-payment-proofs' $$,
  $$ values ('00220000-0000-0000-0000-00000000000b/00220000-0000-0000-0000-0000000d0b01') $$,
  'vendor B sees only their own proof object');
reset role;

-- anon.
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
select throws_ok(
  $$ select 1 from paykit.payment_evidence $$,
  '42501', null, 'anon has no access to payment_evidence');
select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'paykit-payment-proofs' $$,
  'anon cannot read proof objects');
reset role;

-- The service role is the only writer, and cannot delete.
set local role service_role;
select lives_ok(
  $$ insert into paykit.payment_evidence (transaction_id, kind, storage_path, content_hash)
     values ('00220000-0000-0000-0000-0000000d0a02', 'screenshot', 'x', repeat('a', 64)) $$,
  'service role inserts evidence');
select lives_ok(
  $$ update paykit.payment_evidence set content_hash = repeat('d', 64)
     where transaction_id = '00220000-0000-0000-0000-0000000d0a02' $$,
  'service role replaces evidence');
select throws_ok(
  $$ delete from paykit.payment_evidence
     where transaction_id = '00220000-0000-0000-0000-0000000d0a02' $$,
  '42501', null, 'service role cannot delete evidence');
reset role;

select * from finish();
rollback;
