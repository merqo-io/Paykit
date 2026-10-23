-- Public booking inquiries for event vendors: one inquiry form per vendor,
-- and the inquiries a client sends through it. The public form writes with
-- the service role only; a vendor reads and works their own rows.

create table paykit.inquiry_forms (
  vendor_id      uuid primary key references auth.users(id) on delete cascade,
  public_id      text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
    check (public_id ~ '^[0-9a-f]{16}$'),
  business_name  text not null check (char_length(business_name) between 1 and 80),
  enabled        boolean not null default true,
  terms_url      text check (terms_url ~ '^https://' and char_length(terms_url) <= 500),
  terms_version  text check (char_length(terms_version) between 1 and 40),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint inquiry_forms_terms_paired check (
    (terms_url is null) = (terms_version is null)
  )
);

create trigger inquiry_forms_set_updated_at
before update on paykit.inquiry_forms
for each row execute function paykit.set_updated_at();

alter table paykit.inquiry_forms enable row level security;

create policy inquiry_forms_own on paykit.inquiry_forms
  for all
  using (vendor_id = (select auth.uid()))
  with check (vendor_id = (select auth.uid()));

-- `public_id` is left out of the vendor's write grants so it is always the
-- database's random value, never one a vendor picks or collides.
grant select on paykit.inquiry_forms to authenticated;
grant insert (vendor_id, business_name, enabled, terms_url, terms_version)
  on paykit.inquiry_forms to authenticated;
grant update (business_name, enabled, terms_url, terms_version)
  on paykit.inquiry_forms to authenticated;
grant all on paykit.inquiry_forms to service_role;

create table paykit.inquiries (
  id                 uuid primary key default gen_random_uuid(),
  vendor_id          uuid not null references auth.users(id) on delete cascade,
  customer_name      text not null check (char_length(customer_name) between 1 and 80),
  customer_phone     text not null check (customer_phone ~ '^[0-9+ -]{6,20}$'),
  event_date         date,
  message            text not null check (char_length(message) between 1 and 2000),
  status             text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'declined')),
  terms_url          text,
  terms_version      text,
  terms_accepted_at  timestamptz,
  booking_id         uuid references paykit.bookings(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint inquiries_terms_snapshot check (
    (terms_url is null and terms_version is null and terms_accepted_at is null)
    or (terms_url is not null and terms_version is not null and terms_accepted_at is not null)
  )
);
create index inquiries_vendor_created_idx on paykit.inquiries (vendor_id, created_at desc);
create index inquiries_booking_idx on paykit.inquiries (booking_id);

create trigger inquiries_set_updated_at
before update on paykit.inquiries
for each row execute function paykit.set_updated_at();

alter table paykit.inquiries enable row level security;

create policy inquiries_own on paykit.inquiries
  for all
  using (vendor_id = (select auth.uid()))
  with check (vendor_id = (select auth.uid()));

-- No client insert: the public form validates and writes with the service
-- role. A vendor may change only the status, and may delete (a client's
-- withdrawal or erasure request). `booking_id` is set by the service role
-- when converting, after both rows are checked against the vendor.
grant select, delete on paykit.inquiries to authenticated;
grant update (status) on paykit.inquiries to authenticated;
grant all on paykit.inquiries to service_role;
