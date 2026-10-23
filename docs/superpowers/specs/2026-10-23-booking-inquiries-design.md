# Booking inquiries and terms acknowledgment

Status: approved by the owner 2026-10-23 (relayed from the Merqo roadmap session).
Source scope: `docs/business/2026-08-18-feature-discussion-per-kit.md`, "Sizing pass (2026-08-18)".

## Why

Event-cart vendors (weddings, private events) are Merqo's first customers. Their
leads arrive scattered across WhatsApp, Instagram DMs and calls. The tools they
compare us with (HoneyBook, Dubsado) start at the inquiry; every Merqo kit starts
at a booking or order that already exists. The 08-18 sizing pass found that
centralizing inquiries is the real pain, not pipeline automation, and that a
tick box with a timestamp and a terms version is a valid acknowledgment.

## Decisions (owner)

- paykit owns both the public inquiry form and the inbox. merqo has no vendor
  public pages, so the 08-18 "form on the hub" split would have needed a new
  merqo page plus a merqo to paykit write API for one form.
- Public URL: `https://paykit.merqo.io/inquire/<public id>`.
- Inquiries show on paykit's Bookings page with an "Inquiry" status. The vendor
  converts one into a normal booking.
- A new inquiry alerts the vendor through merqo's `POST /api/merqo/notify-vendor`
  (the shared vendor Telegram bot).
- Contract acknowledgment is in scope: the client ticks a box accepting the
  vendor's own terms, recorded with a timestamp and the terms version, with a
  `contract_url` link out to the vendor's document.
- PDPA point-of-collection notice with `@merqo/ui`'s `DataCollectionNotice`.
  No marketing consent tick.
- Rate limiting and bot protection on the public endpoint.

## Non-goals and anti-goals

- No automation, lead scoring, nurture sequences or multi-channel import. These
  are what would turn this back into HoneyBook.
- No e-signature infrastructure.
- No change to merqo's own Pilot Agreement acceptance (`legal-accept`, doc type
  `pilot`); that is Merqo's contract with the vendor and already exists.
- No new dependency.

## Data model (migration `0025_booking_inquiries.sql`)

The 08-18 doc suggested an `inquiry` value on `bookings.status`. Builder's call:
a separate table instead. A booking requires amounts and dates that an inquiry
does not have, and `bookings` feeds the status trigger, reports and metrics,
which would all have to learn to skip a row with no money. The owner's intent
("shows in Bookings with an Inquiry status, converts into a booking") is kept in
the UI.

`paykit.inquiry_forms`, one row per vendor:

- `vendor_id` PK, references `auth.users`.
- `public_id` text unique, 16 random URL-safe characters, set by the database.
  The URL never shows the vendor id, same rule as the pay page.
- `business_name` text, 1 to 80 characters, shown as the form heading.
- `enabled` boolean, default true. A disabled form answers 404.
- `terms_url` text null, `https://` only, at most 500 characters.
- `terms_version` text null, at most 40 characters. Both terms columns are
  set together or both null.
- RLS: own row for select, insert and update. Column grants exclude
  `public_id` so a vendor cannot pick or collide one.

`paykit.inquiries`:

- `id`, `vendor_id`, `customer_name` (1 to 80), `customer_phone` (required, 6 to
  20 characters of digits, spaces, `+`, `-`), `event_date` date null,
  `message` (1 to 2000).
- `status`: `new`, `contacted`, `converted`, `declined`. Default `new`.
- `terms_url`, `terms_version`, `terms_accepted_at`: a snapshot of what the
  client accepted. Null when the vendor had no terms set.
- `booking_id` references `bookings` on delete set null.
- RLS: own rows for select, update and delete. The vendor may update `status`
  only. No client insert: the public form writes through the service role.
- Retention: the vendor can delete an inquiry, which satisfies a client's
  withdrawal or erasure request. No automatic purge (builder's call, flagged).

## Public form `/inquire/[publicId]`

- Server component, service-role read of the form by `public_id`, 404 when
  missing or disabled. `noindex`, `no-referrer`, like `/pay`.
- Fields: name, phone, event date (optional), message.
- When the vendor set terms: a required tick box, "I have read and agree to
  {business}'s booking terms (version {v})", the words "booking terms" linking
  to `terms_url` in a new tab.
- `DataCollectionNotice` with purpose "pass your inquiry to {business} so they
  can reply". Name and phone are what the notice names, so no email field.
- Submit is a server action:
  - Zod validation.
  - Bot protection: a hidden honeypot field, and a render timestamp; a submit
    with the honeypot filled or under 3 seconds after render gets the normal
    success screen but stores nothing. Builder's call: no CAPTCHA service, which
    would need a new dependency and third-party keys.
  - Rate limits through `check_rate_limit`: 5 per address per 10 minutes, 30 per
    form per hour. Over the limit answers "Too many inquiries. Try again later."
  - Insert with the service role. The terms snapshot is taken from the form row
    read in the same action, never from the browser.
  - Telegram alert to the vendor, fire and forget, after the insert. A failed
    alert never fails the submit.
  - Success screen: "Inquiry sent. {business} will contact you."

## Vendor side (Bookings page)

- An "Inquiry form" card: create or edit the business name and optional terms
  URL and version, turn the form on or off, copy the public link.
- An "Inquiries" table above bookings: name, event date, received, status badge
  ("Inquiry" for `new`, then "Contacted", "Converted", "Declined"). Each row opens
  `/dashboard/bookings/inquiries/[id]`.
- Inquiry detail: phone (tap to call, WhatsApp link), message, event date, the
  terms snapshot ("Accepted booking terms version 2 on 23 Oct 2026, 14:05"),
  status actions (mark contacted, decline), delete, and "Convert to booking".
- Convert opens the existing new-booking dialog prefilled with name, phone and
  event date. On success the existing `createBookingAction` links the inquiry
  (`booking_id`, status `converted`) with the service role, scoped by vendor id
  on both rows. The booking detail shows the terms snapshot when it came from an
  inquiry.

## Alert text

Plain text (merqo sends without a parse mode), with no link:
`New paykit inquiry from {name}{, event {date}}. Open Bookings in paykit to reply.`
Builder's call: paykit has no configured public origin, and a link built from
request headers could be pointed elsewhere; with no link, a forged inquiry
cannot put a phishing link in front of the vendor.

## Left to the builder

Component layout, exact copy beyond the strings above, test split.

## Owner steps

1. Run `0025_booking_inquiries.sql` on staging (`merqo-staging`), check, then prod.
2. No new environment variable: the alert reuses `MERQO_BASE_URL` and
   `MERQO_CUSTOMER_SECRET`.
