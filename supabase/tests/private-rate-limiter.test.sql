begin;
select no_plan();

set local role anon;
select throws_ok($$ select paykit.check_rate_limit('acl-negative', 2, 60) $$,
  '42501', null, 'anonymous caller cannot create or exhaust limiter counters');
reset role;
set local role authenticated;
select throws_ok($$ select paykit.check_rate_limit('acl-negative', 2, 60) $$,
  '42501', null, 'authenticated caller cannot create or exhaust limiter counters');
reset role;
select is_empty($$ select 1 from paykit.rate_limits where key = 'acl-negative' $$,
  'denied callers left counters unchanged');

set local role service_role;
select is(paykit.check_rate_limit('acl-service', 2, 60), true, 'first service hit allowed');
select is(paykit.check_rate_limit('acl-service', 2, 60), true, 'second service hit allowed');
select is(paykit.check_rate_limit('acl-service', 2, 60), false, 'same-window third service hit denied');
select is(paykit.check_rate_limit('acl-independent', 2, 60), true, 'different key has its own counter');
select throws_ok($$ select paykit.check_rate_limit(null, 2, 60) $$, '22023', null, 'null key rejected');
select throws_ok($$ select paykit.check_rate_limit('', 2, 60) $$, '22023', null, 'empty key rejected');
select throws_ok($$ select paykit.check_rate_limit(repeat('x', 256), 2, 60) $$, '22023', null, 'oversized key rejected');
select throws_ok($$ select paykit.check_rate_limit('bad-limit', 0, 60) $$, '22023', null, 'zero limit rejected');
select throws_ok($$ select paykit.check_rate_limit('bad-limit', 100001, 60) $$, '22023', null, 'oversized limit rejected');
select throws_ok($$ select paykit.check_rate_limit('bad-limit', null, 60) $$, '22023', null, 'null limit rejected');
select throws_ok($$ select paykit.check_rate_limit('bad-window', 2, 0) $$, '22023', null, 'zero window rejected');
select throws_ok($$ select paykit.check_rate_limit('bad-window', 2, 86401) $$, '22023', null, 'oversized window rejected');
select throws_ok($$ select paykit.check_rate_limit('bad-window', 2, null) $$, '22023', null, 'null window rejected');
select is(paykit.check_rate_limit(repeat('x', 255), 100000, 86400), true, 'maximum supported boundaries work');
reset role;

select is((select count from paykit.rate_limits where key = 'acl-service'), 3, 'atomic conflict update recorded all three hits');
select is_empty($$ select 1 from paykit.rate_limits where key in ('bad-limit', 'bad-window') $$,
  'invalid parameters left no counters');
insert into paykit.rate_limits (key, window_start, count)
  values ('acl-old-window', now() - interval '2 days', 100000);
set local role service_role;
select is(paykit.check_rate_limit('acl-old-window', 1, 60), true, 'expired window does not consume current allowance');
reset role;

select ok(not has_table_privilege('service_role', table_name, privilege), table_name || ' denies service ' || privilege)
from (values ('paykit.admin_audit'), ('paykit.payment_audit')) tables(table_name)
cross join (values ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privileges(privilege);
select ok(has_table_privilege('service_role', table_name, privilege), table_name || ' retains service ' || privilege)
from (values ('paykit.admin_audit'), ('paykit.payment_audit')) tables(table_name)
cross join (values ('SELECT'), ('INSERT')) privileges(privilege);
select ok(has_table_privilege('service_role', 'paykit.rate_limits', 'SELECT'), 'service_role can read rate_limits');
select ok(not has_table_privilege('service_role', 'paykit.rate_limits', 'INSERT, UPDATE, DELETE'), 'service_role cannot write rate_limits directly');
select ok(not has_table_privilege('anon', 'paykit.rate_limits', 'SELECT'), 'anon cannot read rate_limits');
select ok(not has_table_privilege('authenticated', 'paykit.rate_limits', 'SELECT'), 'authenticated cannot read rate_limits');
select * from finish();
rollback;
