-- Proof storage deletion queue (migration 0032): deleting a payment_evidence
-- row, directly or by cascade from its transaction, queues the screenshot's
-- object path, and no client role can touch the queue. Run with `supabase test db`.
begin;
select no_plan();

select has_table('paykit', 'proof_storage_deletions', 'queue table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'paykit.proof_storage_deletions'::regclass),
  'queue has RLS enabled');
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'paykit' and tablename = 'proof_storage_deletions'),
  0, 'queue has no policies');
select ok(
  (select prosecdef from pg_proc where oid = 'paykit.queue_proof_storage_deletion()'::regprocedure),
  'trigger function is security definer');
select ok(
  (select 'search_path=""' = any (proconfig)
     from pg_proc where oid = 'paykit.queue_proof_storage_deletion()'::regprocedure),
  'trigger function pins an empty search_path');

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00320000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'proof-queue@test.local');

insert into paykit.transactions (id, vendor_id, kit_slug, order_ref, amount_cents, status, qr_payload)
values
  ('00320000-0000-0000-0000-000000000101', '00320000-0000-0000-0000-00000000000a',
   'paykit', 'proof-queue-direct', 100, 'pending', 'payload'),
  ('00320000-0000-0000-0000-000000000102', '00320000-0000-0000-0000-00000000000a',
   'paykit', 'proof-queue-cascade', 100, 'pending', 'payload');

insert into paykit.payment_evidence (transaction_id, kind, storage_path, content_hash)
values
  ('00320000-0000-0000-0000-000000000101', 'screenshot',
   '00320000-0000-0000-0000-00000000000a/00320000-0000-0000-0000-000000000101', repeat('a', 64)),
  ('00320000-0000-0000-0000-000000000102', 'screenshot',
   '00320000-0000-0000-0000-00000000000a/00320000-0000-0000-0000-000000000102', repeat('b', 64));

delete from paykit.proof_storage_deletions;

update paykit.payment_evidence
   set content_hash = repeat('c', 64)
 where transaction_id = '00320000-0000-0000-0000-000000000101';
select is(
  (select count(*)::int from paykit.proof_storage_deletions), 0,
  'replacing a screenshot (an update) queues nothing');

delete from paykit.payment_evidence
 where transaction_id = '00320000-0000-0000-0000-000000000101';
select results_eq(
  $$ select bucket, path, attempts from paykit.proof_storage_deletions $$,
  $$ values ('paykit-payment-proofs'::text,
             '00320000-0000-0000-0000-00000000000a/00320000-0000-0000-0000-000000000101'::text,
             0) $$,
  'a direct evidence delete queues the object path');

delete from paykit.transactions
 where id = '00320000-0000-0000-0000-000000000102';
select is(
  (select count(*)::int from paykit.payment_evidence
    where transaction_id = '00320000-0000-0000-0000-000000000102'), 0,
  'deleting the transaction cascades the evidence row');
select results_eq(
  $$ select path from paykit.proof_storage_deletions order by id $$,
  $$ values
       ('00320000-0000-0000-0000-00000000000a/00320000-0000-0000-0000-000000000101'::text),
       ('00320000-0000-0000-0000-00000000000a/00320000-0000-0000-0000-000000000102'::text) $$,
  'a cascade delete queues the object path too');

set local role anon;
select throws_ok(
  $$ select * from paykit.proof_storage_deletions $$, '42501', null,
  'anon cannot read the queue');
select throws_ok(
  $$ insert into paykit.proof_storage_deletions (bucket, path) values ('b', 'p') $$,
  '42501', null, 'anon cannot write the queue');
reset role;

set local role authenticated;
select throws_ok(
  $$ select * from paykit.proof_storage_deletions $$, '42501', null,
  'authenticated cannot read the queue');
select throws_ok(
  $$ insert into paykit.proof_storage_deletions (bucket, path) values ('b', 'p') $$,
  '42501', null, 'authenticated cannot write the queue');
reset role;

set local role service_role;
select lives_ok(
  $$ select * from paykit.proof_storage_deletions $$,
  'service_role can read the queue');
select lives_ok(
  $$ delete from paykit.proof_storage_deletions $$,
  'service_role can clear the queue');
reset role;

select * from finish();
rollback;
