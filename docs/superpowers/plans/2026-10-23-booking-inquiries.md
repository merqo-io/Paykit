# Booking Inquiries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public inquiry form per vendor, an inquiry inbox on the Bookings page, conversion to a booking, a terms acknowledgment snapshot, and a Telegram alert.

**Architecture:** Two new tables in `paykit` (`inquiry_forms`, `inquiries`). The public page reads and writes through the service role inside a server action; the vendor side uses RLS and column grants. The alert goes through merqo's `notify-vendor`.

**Tech Stack:** Next 16 App Router, Supabase, Zod, shadcn/ui, `@merqo/ui`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-booking-inquiries-design.md`

## Global Constraints

- No em dashes in any copy. No new dependency. New shadcn primitives through the CLI only (`checkbox`).
- Every input through Zod `safeParse`.
- Service-role client only in server actions and server components.
- Migration written, never applied by the agent.
- README and CHANGELOG updated in the same PR.

## Review Focus

- A disabled or unknown form id must 404 on both page view and submit (submit must re-read the form).
- Terms snapshot must come from the server-read form, not hidden fields.
- A failed Telegram alert or limiter error must never lose the stored inquiry.
- Converting must not link an inquiry of another vendor (both filters on `vendor_id`).
- Bot submits (honeypot, too fast) answer success and store nothing.

---

### Task 1: Migration, types, schemas

**Files:** Create `supabase/migrations/0025_booking_inquiries.sql`, `test/db/booking-inquiries-schema.test.ts`, `supabase/tests/booking-inquiries.test.sql`. Modify `src/lib/types.ts`, `src/lib/schemas.ts` (+ test).

**Produces:** `InquiryStatus`, `InquiryForm`, `Inquiry` types; `inquiryFormSettingsSchema`, `publicInquirySchema`, `inquiryStatusUpdateSchema`.

- [ ] Regex test asserts tables, RLS, grants (no `public_id` in vendor grants, no insert grant on `inquiries` to `authenticated`), status check.
- [ ] Schema tests: phone pattern, message 1..2000, terms url https-only and paired with version.
- [ ] pgTAP: vendor A cannot read vendor B's inquiries; vendor cannot insert into inquiries.

### Task 2: Public form `/inquire/[publicId]`

**Files:** `src/lib/inquiries.ts` (`loadPublicForm`, `submitInquiry`, `inquiryAllowed`), `src/lib/inquiry-alert.ts` (`sendInquiryAlert`), `src/app/inquire/[publicId]/{page,inquiry-form,actions}.tsx`, `next.config.ts` header rule.

- [ ] Action tests: honeypot and fast submit store nothing and return ok; rate limited returns error; disabled form returns not found; terms required when set; snapshot from the form row; alert failure still ok.
- [ ] DOM test: notice text, terms checkbox only with terms.

### Task 3: Vendor inbox and settings

**Files:** `src/app/dashboard/bookings/{inquiry-form-settings,inquiry-table,inquiry-badges,inquiry-actions}.tsx|ts`, `src/app/dashboard/bookings/inquiries/[id]/page.tsx`, modify `page.tsx`, `new-booking-dialog.tsx` (prefill + `inquiry_id`), `actions.ts` (link on create), `[id]/page.tsx` (terms snapshot).

- [ ] Action tests: save settings, status update, delete, convert links with vendor filters.
- [ ] DOM tests: table badges, settings copy link.

### Task 4: Docs, version, verify

- [ ] READMEs (bookings, inquire, lib, migrations, test/db), AGENTS data model line, CHANGELOG stamped `0.1.11`, `package.json` 0.1.11.
- [ ] `pnpm check`, `pnpm test`, `pnpm build`.
