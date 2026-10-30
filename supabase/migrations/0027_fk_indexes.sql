-- Index every foreign key column (Supabase advisor: unindexed foreign keys).
create index if not exists admin_audit_admin_id_idx on paykit.admin_audit (admin_id);
create index if not exists feedback_vendor_id_idx on paykit.feedback (vendor_id);
create index if not exists refunds_created_by_idx on paykit.refunds (created_by);
