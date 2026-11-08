-- Data retention (roadmap X-26): a payment screenshot is deleted when the
-- payment_evidence row that points at it is deleted. Postgres cannot remove
-- Storage objects, so a delete queues the object path here and the app drains
-- the queue through the Storage API with the service role.

create table if not exists paykit.proof_storage_deletions (
  id bigserial primary key,
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text
);

alter table paykit.proof_storage_deletions enable row level security;

-- No policies: only the service role, which bypasses RLS, reads or writes it.
revoke all on table paykit.proof_storage_deletions from public, anon, authenticated;
revoke all on sequence paykit.proof_storage_deletions_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table paykit.proof_storage_deletions to service_role;
grant usage, select on sequence paykit.proof_storage_deletions_id_seq to service_role;

-- A row trigger fires for cascade deletes too (transaction delete, vendor
-- delete, auth user delete), which is how most evidence rows disappear. It also
-- fires when a re-upload points the row at a new object, because each upload
-- attempt gets its own path and the previous object would otherwise be orphaned.
create or replace function paykit.queue_proof_storage_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.storage_path is not distinct from new.storage_path then
    return null;
  end if;
  if old.storage_path is not null then
    insert into paykit.proof_storage_deletions (bucket, path)
    values ('paykit-payment-proofs', old.storage_path);
  end if;
  return null;
end;
$$;

revoke execute on function paykit.queue_proof_storage_deletion() from public, anon, authenticated;

drop trigger if exists payment_evidence_queue_proof_storage_deletion on paykit.payment_evidence;
create trigger payment_evidence_queue_proof_storage_deletion
  after delete or update of storage_path on paykit.payment_evidence
  for each row
  execute function paykit.queue_proof_storage_deletion();
