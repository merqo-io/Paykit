# actions

## Purpose

Server actions shared across the app rather than scoped to one dashboard
sub-route — sign-out, the two Sheet-embedded widgets reachable from
`dashboard-nav.tsx` (Feedback, Get help).

## Contents

- `auth.ts` — `signOutAction()`: signs the current session out
  (`supabase.auth.signOut()`) and redirects to `/login`. Backs
  `DashboardNav`'s real `<form action={signOut}>` submit.
- `feedback.ts` — `submitFeedbackAction(input: FeedbackInput)`: validates
  with `feedbackSchema`, calls `submitVendorFeedback`
  (`@/lib/merqo-vendor-feedback`) to file into the shared cross-kit
  `merqo.vendor_feedback` table via `merqo.submit_vendor_feedback`, using an
  inline `supabase.auth.getUser()` check (not `getVendorSession()` — that
  helper redirects to `/login` on no session, wrong for a Sheet-embedded
  widget, which should surface a toast error instead of yanking the vendor
  off whatever page the Sheet was open on).
- `feedback.test.ts` — mocks `createServerClient`'s `auth.getUser`/
  `schema().rpc()` chain: the RPC is called with the parsed nps/message and
  paykit's fixed `p_kit_slug: "paykit"`, an out-of-range nps never reaches
  the RPC, an unauthenticated caller gets an error without a redirect, and
  an RPC failure surfaces a friendly message (never the raw error).
- `support.ts` — `submitSupportMessageAction(input: unknown)`: validates
  with `supportMessageSchema`, calls `submitSupportMessage`
  (`@/lib/merqo-support`) to file into the shared cross-kit
  `merqo.support_messages` inbox via `merqo.submit_support_message`. Same
  inline-session-check reasoning as `feedback.ts` — Get-help is also a
  Sheet-embedded widget, not a full page.
- `support.test.ts` — mocks `createServerClient`'s
  `auth.getUser`/`schema().rpc()` chain: the RPC is called with the
  parsed category/body and paykit's fixed `p_kit_slug: "paykit"`, invalid
  input never reaches the RPC, an unauthenticated caller gets an error
  without a redirect, and an RPC failure surfaces a friendly message
  (never the raw error).

## Connectivity

`auth.ts`'s `signOutAction` is passed into `DashboardNav` by
`dashboard/layout.tsx`. `feedback.ts`'s and `support.ts`'s actions are
called by `FeedbackForm` and `SupportForm` (`@/components`) respectively,
both rendered inside `dashboard-nav.tsx`'s Feedback/Get-help `Sheet`
drawers.

## Parent

[app](../README.md)

Server actions here return the shared `ActionResult` shape from `@merqo/ui/kit-api`; paykit keeps no local copy.
