-- 0029_drop_vendor_plan.sql
-- Legacy Pro vendors become paid with no expiry; merqo's next push replaces
-- the row. issued_at is the epoch so any real push wins the ordering check.
insert into paykit.vendor_entitlements
  (vendor_id, tier, founder, stats_window, valid_until, issued_at)
  select vendor_id, 'paid', false, '90d', null, to_timestamp(0)
  from paykit.vendor_payment_config
  where plan = 'pro'
  on conflict (vendor_id) do nothing;

-- Dropping the column also drops its column-level grants (0001, 0003).
alter table paykit.vendor_payment_config drop column plan;
