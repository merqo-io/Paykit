-- Evidence about a transaction: what a customer or, later, a detector offers
-- as a sign that money moved. Today the only kind is the payment screenshot a
-- calling kit attaches to a claim. It is evidence for a human to look at and
-- never changes a transaction's status by itself.

-- Private bucket. The name carries the kit prefix because every kit shares
-- this Supabase project and qkit already owns a bucket named payment-proofs.
-- The limits repeat what the claim route checks, so they hold for any writer.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'paykit-payment-proofs', 'paykit-payment-proofs', false, 1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Object path: {vendor_id}/{transaction_id}. A signed-in vendor may read the
-- objects in their own folder. No insert, update or delete policy exists for
-- authenticated or anon: every write goes through the service role.
create policy "paykit_payment_proofs_vendor_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'paykit-payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create table paykit.payment_evidence (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references paykit.transactions(id) on delete cascade,
  kind           text not null check (kind in ('screenshot')),
  storage_path   text,
  content_hash   text,
  detail         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  -- One row per kind: a second screenshot for a transaction replaces the first.
  constraint payment_evidence_one_per_kind unique (transaction_id, kind),
  constraint payment_evidence_screenshot_shape check (
    kind <> 'screenshot'
    or (storage_path is not null and content_hash ~ '^[0-9a-f]{64}$')
  )
);

-- The duplicate check looks a hash up across every transaction.
create index payment_evidence_hash_idx
  on paykit.payment_evidence (content_hash)
  where content_hash is not null;

alter table paykit.payment_evidence enable row level security;

create policy payment_evidence_vendor_select on paykit.payment_evidence
  for select using (
    transaction_id in (
      select id from paykit.transactions where vendor_id = (select auth.uid())
    )
  );

create policy payment_evidence_admin_select on paykit.payment_evidence
  for select using (paykit.is_admin((select auth.uid())));

-- No delete for anyone: a screenshot is replaced, never removed, by the app.
revoke all on paykit.payment_evidence
  from public, anon, authenticated, service_role;
grant select on paykit.payment_evidence to authenticated;
grant select, insert, update on paykit.payment_evidence to service_role;
