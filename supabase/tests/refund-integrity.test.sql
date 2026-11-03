begin;
select no_plan();
insert into auth.users (id, instance_id, aud, role, email) values
 ('a0200000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','refund-owner@test.local'),
 ('a0200000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','refund-other@test.local');
insert into paykit.vendor_payment_config (vendor_id, mobile, payee_name)
values ('a0200000-0000-0000-0000-000000000001','+6590000001','Refund owner');
insert into paykit.vendor_entitlements (vendor_id, tier, issued_at)
values ('a0200000-0000-0000-0000-000000000001','paid','2026-11-01T00:00:00Z');
insert into paykit.transactions (id,vendor_id,kit_slug,order_ref,amount_cents,status,qr_payload)
select ('b0200000-0000-0000-0000-00000000000' || n)::uuid,
 'a0200000-0000-0000-0000-000000000001','qkit','refund-' || n,
 case when n=5 then 2147483647 else 1000 end,
 case when n=3 then 'pending' else 'confirmed' end,'refund-fixture'
from generate_series(1,5) n;
create function pg_temp.add_refund(n integer, cents integer) returns void language sql as $$
 insert into paykit.refunds(transaction_id,refunded_amount_cents,created_by)
 values (('b0200000-0000-0000-0000-00000000000' || n)::uuid,cents,
 'a0200000-0000-0000-0000-000000000001');
$$;
select set_config('request.jwt.claims','{"sub":"a0200000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select pg_temp.add_refund(1,1001)$$,'23514',null,'single refund cannot exceed payment');
select lives_ok($$select pg_temp.add_refund(1,600)$$,'first partial refund accepted');
select lives_ok($$select pg_temp.add_refund(1,400)$$,'remaining balance refund accepted');
select throws_ok($$select pg_temp.add_refund(1,1)$$,'23514',null,'fully refunded payment cannot accept another cent');
select throws_ok($$select pg_temp.add_refund(3,1)$$,'42501',null,'pending payment denied before privileged lookup');
select throws_ok($$
 insert into paykit.refunds(transaction_id,refunded_amount_cents,created_by)
 values ('b0200000-0000-0000-0000-000000000002',600,'a0200000-0000-0000-0000-000000000001'),
 ('b0200000-0000-0000-0000-000000000002',600,'a0200000-0000-0000-0000-000000000001')
$$,'23514',null,'multirow insert cannot exceed aggregate cap');
select lives_ok($$select pg_temp.add_refund(5,2147483647)$$,'maximum integer checkout refund accepted');
select throws_ok($$select pg_temp.add_refund(5,2147483647)$$,'23514',null,'aggregate calculation does not overflow integer');
reset role;
select is((select sum(refunded_amount_cents) from paykit.refunds where transaction_id='b0200000-0000-0000-0000-000000000001'),1000::bigint,'accepted partials total exactly original payment');
select is_empty($$select 1 from paykit.refunds where transaction_id='b0200000-0000-0000-0000-000000000002'$$,'failed multirow insert rolls back all rows');
select set_config('request.jwt.claims','{"sub":"a0200000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select pg_temp.add_refund(1,2147483647)$$,'42501',null,'foreign vendor receives authorization error rather than amount disclosure');
reset role;
set local role service_role;
select throws_ok($$select pg_temp.add_refund(3,1)$$,'23514',null,'service role also requires confirmed payment');
select lives_ok($$update paykit.refunds set refunded_amount_cents=500 where transaction_id='b0200000-0000-0000-0000-000000000001' and refunded_amount_cents=600$$,'amount correction excludes its own old amount');
select throws_ok($$update paykit.refunds set refunded_amount_cents=700 where transaction_id='b0200000-0000-0000-0000-000000000001' and refunded_amount_cents=500$$,'23514',null,'service update cannot exceed cumulative cap');
select throws_ok($$update paykit.refunds set transaction_id='b0200000-0000-0000-0000-000000000002' where transaction_id='b0200000-0000-0000-0000-000000000001'$$,'23514',null,'refund cannot move to another payment');
select throws_ok($$update paykit.refunds set created_by='a0200000-0000-0000-0000-000000000002' where transaction_id='b0200000-0000-0000-0000-000000000001'$$,'23514',null,'refund attribution cannot change');
select throws_ok($$update paykit.refunds set created_at=created_at+interval '1 day' where transaction_id='b0200000-0000-0000-0000-000000000001'$$,'23514',null,'refund timestamp cannot change');
select throws_ok($$update paykit.refunds set id=gen_random_uuid() where transaction_id='b0200000-0000-0000-0000-000000000001'$$,'23514',null,'refund identity cannot change');
reset role;
select ok(not has_function_privilege('service_role','paykit.enforce_refund_total()','EXECUTE'),'trigger helper is not a callable service RPC');
select * from finish();
rollback;
