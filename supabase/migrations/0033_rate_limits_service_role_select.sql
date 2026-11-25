-- 0001's blanket `grant all on all tables ... to service_role` ran before
-- 0012 created rate_limits, so a database built from migrations alone had no
-- table privilege for service_role and the /admin overview read failed with
-- 42501. SELECT only: writes go through the security-definer check_rate_limit.
grant select on paykit.rate_limits to service_role;
